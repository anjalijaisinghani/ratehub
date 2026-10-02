import { Link } from 'react-router-dom';

const features = [
  { icon: '🔍', title: 'Find stores fast', text: 'Browse every registered store and search by name or address in seconds.' },
  { icon: '⭐', title: 'Rate from 1 to 5', text: 'Share your experience with a simple star rating, and change it whenever you like.' },
  { icon: '📊', title: 'Insights for owners', text: 'Store owners see their average rating and exactly who rated their store.' },
  { icon: '🛡️', title: 'Admin control', text: 'Administrators manage users and stores and track platform totals in one dashboard.' },
  { icon: '🔐', title: 'Secure by design', text: 'Hashed passwords, token-based login and role-based access on every page.' },
  { icon: '📱', title: 'Works on any screen', text: 'A responsive layout that looks good on phones, tablets and desktops.' },
];

const steps = [
  { title: 'Create your account', text: 'Sign up in under a minute with your name, email and address.' },
  { title: 'Find a store', text: 'Search the list of registered stores by name or address.' },
  { title: 'Leave your rating', text: 'Give 1 to 5 stars. You can update your rating later.' },
];

export default function Landing() {
  return (
    <div>
      {/* ---------- Hero ---------- */}
      <section className="hero">
        <div>
          <span className="hero-tag">⭐ Rate · Review · Support</span>
          <h1>
            Rate the stores you love with <span className="gradient-text">RateHub</span>
          </h1>
          <p className="lead">
            RateHub is a simple platform where customers rate stores from 1 to 5 stars, store owners
            see how they are doing, and administrators keep everything running smoothly.
          </p>
          <div className="hero-actions">
            <Link to="/signup" className="btn btn-lg">Get Started Free</Link>
            <Link to="/login" className="btn btn-outline btn-lg">Login</Link>
          </div>
        </div>

        <div className="hero-visual">
          <img src="/logo-icon.png" alt="RateHub store with a star" />
          <span className="chip c1">⭐ Rate</span>
          <span className="chip c2">💬 Review</span>
          <span className="chip c3">🤝 Support</span>
        </div>
      </section>

      {/* ---------- Features ---------- */}
      <section className="section" id="features">
        <div className="section-title">
          <h2>Everything you need in one place</h2>
          <p>Simple tools for customers, store owners and administrators.</p>
        </div>
        <div className="feature-grid">
          {features.map((f) => (
            <div className="card feature" key={f.title}>
              <div className="icon-box">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section className="section">
        <div className="section-title">
          <h2>How it works</h2>
          <p>Three easy steps to start rating.</p>
        </div>
        <div className="feature-grid">
          {steps.map((s, i) => (
            <div className="card step" key={s.title}>
              <div className="step-num">{i + 1}</div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Roles ---------- */}
      <section className="section">
        <div className="section-title">
          <h2>Built for three kinds of users</h2>
          <p>One login, and each person sees the tools they need.</p>
        </div>
        <div className="feature-grid">
          <div className="card role-card">
            <h3>🛍️ Customers</h3>
            <ul>
              <li>Sign up and log in</li>
              <li>View and search all stores</li>
              <li>Submit and modify ratings</li>
              <li>See each store's overall rating</li>
            </ul>
          </div>
          <div className="card role-card owner">
            <h3>🏪 Store Owners</h3>
            <ul>
              <li>See your store's average rating</li>
              <li>View who rated your store</li>
              <li>Sort and review the feedback</li>
              <li>Update your password anytime</li>
            </ul>
          </div>
          <div className="card role-card admin">
            <h3>🛡️ Administrators</h3>
            <ul>
              <li>Add users, owners and stores</li>
              <li>Dashboard with live totals</li>
              <li>Filter and sort every list</li>
              <li>View full user details</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ---------- Call to action ---------- */}
      <section className="cta-band">
        <h2>Ready to share your experience?</h2>
        <p>Join RateHub today and help others find great stores.</p>
        <Link to="/signup" className="btn btn-lg">Create Free Account</Link>
      </section>

      <footer className="footer">
        <strong className="gradient-text">RateHub</strong> · Rate · Review · Support
        <br />© {new Date().getFullYear()} RateHub. All rights reserved.
      </footer>
    </div>
  );
}