function LoginPage({
    email,
    setEmail,
    password,
    setPassword,
    message,
    handleLogin,
  }) {
    return (
      <div className="login-shell">
        <section className="login-brand">
          <h1>Construction Portal</h1>
  
          <p>
            Manage companies, payments, workers, tenders, subcontractors, invoices
            and site reports from one secure dashboard.
          </p>
        </section>
  
        <section className="login-box">
          <form onSubmit={handleLogin}>
            <h2>Login</h2>
  
            <p>Enter your credentials to continue</p>
  
            <label>Email</label>
  
            <input
              type="email"
              value={email}
              placeholder="admin@test.com"
              onChange={(e) => setEmail(e.target.value)}
            />
  
            <label>Password</label>
  
            <input
              type="password"
              value={password}
              placeholder="Enter password"
              onChange={(e) => setPassword(e.target.value)}
            />
  
            <button type="submit">
              Login to Portal
            </button>
  
            {message && <p className="error">{message}</p>}
          </form>
        </section>
      </div>
    );
  }
  
  export default LoginPage;