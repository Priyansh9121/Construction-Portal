/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| An operator script that creates — or forcibly resets — an administrator
| account for an existing company. The recovery path for the day nobody can
| get in.
|
| "Break glass" is the point: this is the emergency lever, used when the
| last admin has left, locked themselves out, or password reset cannot
| deliver because SMTP is down. It is not part of normal user management,
| which lives in modules/companies/company.controller.js behind an
| authenticated admin session.
|
| Responsibilities:
|   - Validate the three environment variables it is driven by
|   - Confirm the target company exists
|   - Upsert a user with role admin and status active
|   - Upsert the company_users membership row, also as admin
|   - Do all of it in one transaction
|
| Usage:
|   Run from backend/, never in a request. The values are passed inline so
|   the password does not persist in .env or in shell history when prefixed
|   with a space:
|
|     BREAK_GLASS_ADMIN_EMAIL=you@example.com \
|     BREAK_GLASS_ADMIN_PASSWORD='a long passphrase' \
|     BREAK_GLASS_ADMIN_COMPANY_ID=1 \
|     node scripts/createBreakGlassAdmin.js
|
| Environment variables (read directly from process.env, not config/env.js,
| because they are specific to this script and must not exist in the running
| service):
|
|   BREAK_GLASS_ADMIN_EMAIL       required. Lowercased and trimmed.
|   BREAK_GLASS_ADMIN_PASSWORD    required, minimum 12 characters.
|   BREAK_GLASS_ADMIN_COMPANY_ID  required. Must be an existing company.
|
| Exports:
|   none. The module runs main() on require, so importing it from
|   application code would execute it — do not.
|
| Depends on:
|   bcryptjs, dotenv
|   database/pool.js
|
| Database tables touched:
|   companies      SELECT, to verify the target exists
|   users          INSERT ... ON CONFLICT, upsert by lowercased email
|   company_users  INSERT ... ON CONFLICT, upsert the membership
|
| Security:
|   - This grants full administrative access to a tenant, bypassing every
|     authentication and authorisation check in the API. Access to run it is
|     equivalent to owning the company's data.
|   - Running it against an existing email OVERWRITES that user's password
|     and promotes them to admin. There is no confirmation prompt. Check the
|     address before running.
|   - Clears reset_token and reset_token_expires, so any reset link already
|     in someone's inbox stops working.
|   - The password is hashed with bcrypt at cost 12, matching auth.service.js.
|   - Rotate the password through the normal flow once access is restored.
|
| Note:
|   Calls dotenv.config() with no path, so it reads .env relative to the
|   current working directory. Run it from backend/. Requiring
|   database/pool.js pulls in config/env.js, which loads backend/.env by
|   absolute path regardless — so the database connection works either way,
|   but these three variables would not be found from elsewhere.
|
*/

require("dotenv").config();

const bcrypt = require("bcryptjs");
const pool = require("../database/pool");

const {
  BREAK_GLASS_ADMIN_EMAIL,
  BREAK_GLASS_ADMIN_PASSWORD,
  BREAK_GLASS_ADMIN_COMPANY_ID,
} = process.env;

/**
 * Creates or resets the break-glass administrator.
 *
 * Purpose:
 * The whole script. Separated into a function only so `await` can be used
 * throughout and so the finally block can guarantee the pool is closed.
 *
 * Parameters:
 * none — everything comes from the environment.
 *
 * Returns:
 * A promise resolving when the work is done. Nothing awaits it; failure is
 * signalled through process.exitCode.
 *
 * Side effects:
 * Writes to `users` and `company_users`, prints the resulting account to
 * stdout, closes the pool, and sets exit code 1 on failure.
 *
 * Business rules:
 * - The company must already exist. This script grants access to a tenant;
 *   it does not create one.
 * - The password floor is 12 characters, higher than a normal signup would
 *   demand, because this account is the most privileged in the tenant.
 * - Both upserts set role to admin unconditionally, so re-running on an
 *   existing user promotes them rather than failing.
 *
 * Error handling:
 * Everything is inside one transaction, so a failure at any step leaves the
 * database untouched — no user without a membership, no membership without
 * a user. Only error.message is printed, not the stack, to keep a
 * credential out of the output.
 *
 * Notes:
 * A connection is taken from the pool rather than using pool.query, because
 * BEGIN, COMMIT and ROLLBACK must all run on the same connection.
 */
const main = async () => {
  const client = await pool.connect();

  try {
    const email =
      BREAK_GLASS_ADMIN_EMAIL
        ?.trim()
        .toLowerCase();

    const password =
      BREAK_GLASS_ADMIN_PASSWORD;

    const companyId = Number(
      BREAK_GLASS_ADMIN_COMPANY_ID
    );

    /*
     * All three checks run before BEGIN, so a mistyped invocation costs
     * nothing and cannot leave a half-written transaction behind.
     */

    if (!email) {
      throw new Error(
        "BREAK_GLASS_ADMIN_EMAIL is required."
      );
    }

    // Twelve characters minimum. This account is the recovery route into a
    // whole tenant, so it gets a stricter floor than a self-service signup.
    if (
      !password ||
      password.length < 12
    ) {
      throw new Error(
        "BREAK_GLASS_ADMIN_PASSWORD must contain at least 12 characters."
      );
    }

    if (
      !Number.isInteger(companyId) ||
      companyId <= 0
    ) {
      throw new Error(
        "BREAK_GLASS_ADMIN_COMPANY_ID must be a valid positive integer."
      );
    }

    /*
     * From here on, both writes are one unit. Creating the user without the
     * company_users row would produce an admin with no company — an account
     * that can log in but whose every request fails requireCompanyId.
     */
    await client.query("BEGIN");

    /*
     * Verify the company first, so the failure message names the real
     * problem. Relying on the foreign key instead would surface a
     * constraint violation after the password had already been hashed.
     */
    const companyResult =
        await client.query(
            `
            SELECT id, company_name
            FROM public.companies
            WHERE id = $1
            LIMIT 1
            `,
            [companyId]
        );

    if (
      companyResult.rows.length === 0
    ) {
      throw new Error(
        `Company ${companyId} does not exist.`
      );
    }

    /*
     * Cost 12, the same factor auth.service.js uses. It must match, or this
     * account would be cheaper to attack than every other one — and a
     * mismatch would be invisible, since bcrypt stores the cost inside the
     * hash and verifies correctly either way.
     *
     * Hashing takes a few hundred milliseconds by design. That is the point
     * of bcrypt, not a problem to optimise.
     */
    const passwordHash =
      await bcrypt.hash(
        password,
        12
      );

    /*
     * Upsert on the lowercased email, matching the functional unique index
     * on users. ON CONFLICT is what makes the script safe to re-run and
     * usable for its second purpose — resetting an existing admin who is
     * locked out.
     *
     * DO UPDATE resets the password, forces role to admin, reactivates a
     * suspended account, and clears any outstanding reset token so a stale
     * link in an inbox cannot be used afterwards.
     *
     * RETURNING gives back the id needed for the membership insert below,
     * on both the insert and the update path — which a separate SELECT
     * would not do as cleanly.
     */
    const userResult =
      await client.query(
        `
        INSERT INTO public.users
        (
          full_name,
          email,
          password_hash,
          role,
          status,
          reset_token,
          reset_token_expires,
          created_at,
          updated_at
        )
        VALUES
        (
          $1,
          $2,
          $3,
          'admin',
          'active',
          NULL,
          NULL,
          NOW(),
          NOW()
        )

        ON CONFLICT (
          LOWER(email)
        )
        DO UPDATE SET
          full_name = EXCLUDED.full_name,
          password_hash =
            EXCLUDED.password_hash,
          role = 'admin',
          status = 'active',
          reset_token = NULL,
          reset_token_expires = NULL,
          updated_at = NOW()

        RETURNING
          id,
          full_name,
          email,
          role,
          status
        `,
        [
          "Break Glass Admin",
          email,
          passwordHash,
        ]
      );

    const user =
      userResult.rows[0];

      /*
       * The membership row. Without it the user exists but belongs to no
       * company, and getCompanyId would return null on every request.
       *
       * Upserted on (company_id, user_id) so re-running promotes an
       * existing member to admin instead of failing on the unique
       * constraint.
       */
      await client.query(
        `
        INSERT INTO public.company_users
        (
          company_id,
          user_id,
          role,
          created_at
        )
        VALUES
        (
          $1,
          $2,
          'admin',
          NOW()
        )
      
        ON CONFLICT (
          company_id,
          user_id
        )
        DO UPDATE SET
          role = 'admin'
        `,
        [
          companyId,
          user.id,
        ]
      );

    await client.query("COMMIT");

    /*
     * Echo the resulting account so the operator can confirm they targeted
     * the company they meant to. Deliberately prints no password and no
     * hash.
     */
    console.log(
      "Break-glass admin created successfully:"
    );

    console.log({
      id: user.id,
      email: user.email,
      company_id: companyId,
      company:
        companyResult.rows[0]
          .company_name,
      role: "admin",
      status: "active",
    });
  } catch (error) {
    await client.query(
      "ROLLBACK"
    );

    // Only the message, never the stack or the caught object — a pg error
    // can carry the offending parameters, which here would include the
    // password hash.
    console.error(
      "Failed to create break-glass admin:",
      error.message
    );

    // exitCode rather than process.exit(), so the finally block still runs
    // and the pool closes before the process ends. A non-zero code lets a
    // wrapping shell script detect the failure.
    process.exitCode = 1;
  } finally {
    // Release before ending: the pool cannot shut down while a client is
    // still checked out. Without pool.end() the process would hang on the
    // open connection instead of exiting.
    client.release();
    await pool.end();
  }
};

// Invoked on require, which is why this file must never be imported by
// application code — see the note in the header.
main();