/* describe / it / expect come from Vitest globals (globals: true), because a
   CommonJS file cannot require("vitest") directly. */

const {
  escapeHtml,
  sendAccountInviteEmail,
  sendPasswordResetEmail,
} = require("../config/mailer");

/*
|--------------------------------------------------------------------------
| F-07 · user-controlled names in email HTML
|--------------------------------------------------------------------------
|
| Two templates interpolated a full name and a company name straight into
| their markup. Both are user-supplied — a company name at registration, a
| full name when the account was created.
|
| This was never straightforward XSS; most clients strip <script>. It did not
| need to be. The value of the attack is that the surrounding email is
| genuinely from the portal, so a forged second "click here" link inherits
| that trust.
|
| These tests assert the escaping directly and then assert the rendered
| templates, so a future edit that reintroduces a raw ${name} is caught even
| if escapeHtml itself is still correct.
|
*/

describe("F-07 · escapeHtml", () => {
  it("neutralises every character that can open a tag or attribute", () => {
    expect(escapeHtml('<a href="x">&\'')).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&#39;"
    );
  });

  it("escapes the ampersand first, so nothing is double-escaped", () => {
    // "&lt;" typed by a user must survive as literal text, not decode to "<".
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });

  it("renders null and undefined as empty rather than the word", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
});

/*
 * The templates.
 *
 * `sendMail` does not deliver when SMTP is unconfigured, which is the state
 * in test and CI — but it returns the composed message, so what the template
 * BUILT is observable. That matters: the first version of these tests
 * early-returned when no html came back, which made them pass against the
 * unescaped code they exist to catch.
 */
describe("F-07 · templates do not emit user input as markup", () => {
  const ATTACK =
    '<a href="https://evil.example">Click here to verify</a>';

  it("the account invite escapes both the name and the company", async () => {
    const sent = await sendAccountInviteEmail({
      to: "someone@example.test",
      fullName: ATTACK,
      companyName: ATTACK,
      token: "t",
    });

    expect(sent.html, "the template returned no html to inspect").toBeTruthy();

    // The attack must not survive as markup...
    expect(sent.html).not.toContain('<a href="https://evil.example"');
    // ...and must survive as visible text, so the name is not silently lost.
    expect(sent.html).toContain("&lt;a href=&quot;https://evil.example&quot;");
  });

  it("the password reset escapes the name", async () => {
    const sent = await sendPasswordResetEmail({
      to: "someone@example.test",
      fullName: ATTACK,
      token: "t",
      expiresInMinutes: 30,
    });

    expect(sent.html, "the template returned no html to inspect").toBeTruthy();

    expect(sent.html).not.toContain('<a href="https://evil.example"');
    expect(sent.html).toContain("&lt;a href=&quot;https://evil.example&quot;");
  });
});
