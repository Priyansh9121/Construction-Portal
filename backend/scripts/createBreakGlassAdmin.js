require("dotenv").config();

const bcrypt = require("bcryptjs");
const pool = require("../database/pool");

const {
  BREAK_GLASS_ADMIN_EMAIL,
  BREAK_GLASS_ADMIN_PASSWORD,
  BREAK_GLASS_ADMIN_COMPANY_ID,
} = process.env;

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

    if (!email) {
      throw new Error(
        "BREAK_GLASS_ADMIN_EMAIL is required."
      );
    }

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

    await client.query("BEGIN");

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

    const passwordHash =
      await bcrypt.hash(
        password,
        12
      );

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

    console.error(
      "Failed to create break-glass admin:",
      error.message
    );

    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};

main();