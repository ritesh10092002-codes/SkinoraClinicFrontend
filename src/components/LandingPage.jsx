import { useState } from 'react';
import './LandingPage.css';

const LandingPage = ({ onLoginClick, onSignupClick, onBookingClick }) => {
  const [activeSection, setActiveSection] = useState('home');

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setActiveSection(sectionId);
  };

  return (
    <div className="landing-page">
      {/* Navigation */}
      <nav className="landing-nav">
        <div className="nav-container">
          <div className="nav-logo">
            <span className="logo-icon">✦</span>
            <span className="logo-text">SKINORA</span>
          </div>
          
          <ul className="nav-links">
            <li 
              className={activeSection === 'home' ? 'active' : ''}
              onClick={() => scrollToSection('home')}
            >
              Home
            </li>
            <li 
              className={activeSection === 'services' ? 'active' : ''}
              onClick={() => scrollToSection('services')}
            >
              Services
            </li>
            <li 
              className={activeSection === 'about' ? 'active' : ''}
              onClick={() => scrollToSection('about')}
            >
              About
            </li>
            <li 
              className={activeSection === 'contact' ? 'active' : ''}
              onClick={() => scrollToSection('contact')}
            >
              Contact
            </li>
          </ul>

          <div className="nav-actions">
            <button className="booking-btn" onClick={onBookingClick}>
              <span className="btn-icon">📅</span>
              Book Now
            </button>
            <button className="login-btn" onClick={onLoginClick}>
              Login
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="home" className="hero-section">
        <div className="hero-background">
          <div className="hero-overlay"></div>
          <div className="hero-particles"></div>
        </div>
        <div className="hero-content">
          <div className="hero-badge">
            <span>✨ Premier Skin & Hair Clinic</span>
          </div>
          <h1 className="hero-title">
            Reveal Your <span className="highlight">True Beauty</span>
          </h1>
          <p className="hero-subtitle">
            Experience world-class dermatology and aesthetic treatments at Skinora. 
            Our expert team combines advanced technology with personalized care to give you 
            the radiant skin and luscious hair you deserve.
          </p>
          <div className="hero-cta">
            <button className="cta-primary" onClick={onBookingClick}>
              <span>Book Your Consultation</span>
              <span className="cta-arrow">→</span>
            </button>
            <button className="cta-secondary" onClick={() => scrollToSection('services')}>
              Explore Services
            </button>
          </div>
          <div className="hero-stats">
            <div className="stat-item">
              <span className="stat-number">10k+</span>
              <span className="stat-label">Happy Patients</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">2</span>
              <span className="stat-label">Expert Doctors</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">50+</span>
              <span className="stat-label">Treatments</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">98%</span>
              <span className="stat-label">Satisfaction Rate</span>
            </div>
          </div>
        </div>
        <div className="hero-visual">
          <div className="visual-card card-1">
            <div className="card-icon">💆</div>
            <span>Skin Care</span>
          </div>
          <div className="visual-card card-2">
            <div className="card-icon">💇</div>
            <span>Hair Care</span>
          </div>
          <div className="visual-card card-3">
            <div className="card-icon">🔬</div>
            <span>Laser Treatment</span>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="services-section">
        <div className="section-container">
          <div className="section-header">
            <span className="section-tag">Our Services</span>
            <h2 className="section-title">Comprehensive <span className="highlight">Treatments</span></h2>
            <p className="section-subtitle">
              From advanced skin treatments to revolutionary hair restoration, 
              we offer a complete range of aesthetic solutions tailored to your needs.
            </p>
          </div>

          <div className="services-grid">
            <div className="service-card">
              <div className="service-icon">
                <span>✨</span>
              </div>
              <h3>Skin Treatments</h3>
              <ul className="service-list">
                <li>Anti-aging & Wrinkle Reduction</li>
                <li>Acne & Scar Treatment</li>
                <li>Skin Rejuvenation</li>
                <li>Chemical Peels</li>
                <li>Microdermabrasion</li>
                <li>HydraFacial</li>
              </ul>
            </div>

            <div className="service-card featured">
              <div className="featured-badge">Most Popular</div>
              <div className="service-icon">
                <span>💎</span>
              </div>
              <h3>Laser Treatments</h3>
              <ul className="service-list">
                <li>Laser Hair Removal</li>
                <li>Laser Skin Resurfacing</li>
                <li> tattoo Removal</li>
                <li>Pigmentation Treatment</li>
                <li>Vein Treatment</li>
                <li>Stretch Mark Reduction</li>
              </ul>
            </div>

            <div className="service-card">
              <div className="service-icon">
                <span>🌟</span>
              </div>
              <h3>Hair Treatments</h3>
              <ul className="service-list">
                <li>Hair Restoration</li>
                <li>PRP Therapy</li>
                <li>Hair Fall Treatment</li>
                <li>Scalp Treatment</li>
                <li>Keratin Treatment</li>
                <li>Hair Transplantation</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="features-section">
        <div className="section-container">
          <div className="section-header">
            <span className="section-tag">Why Skinora</span>
            <h2 className="section-title">Experience Excellence in <span className="highlight">Care</span></h2>
          </div>
          
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🏥</div>
              <h3>World-Class Facility</h3>
              <p>State-of-the-art clinic equipped with the latest technology and premium amenities for your comfort.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">👨‍⚕️</div>
              <h3>Expert Dermatologists</h3>
              <p>Our team of certified specialists brings years of experience and stays updated with latest advancements.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <h3>Personalized Care</h3>
              <p>Every treatment plan is customized to your unique needs, ensuring optimal results for your specific concerns.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h3>Safe & Secure</h3>
              <p>Your safety is our priority. We maintain the highest standards of hygiene and follow strict protocols.</p>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="about-section">
        <div className="section-container">
          <div className="about-content">
            <div className="about-text">
              <span className="section-tag">About Skinora</span>
              <h2 className="section-title">Your Journey to <span className="highlight">Radiance</span> Starts Here</h2>
              <p>
                At Skinora, we believe everyone deserves to feel confident in their own skin. 
                Founded with a vision to provide premium aesthetic treatments accessible to all, 
                we've become a trusted name in dermatology and hair care.
              </p>
              <p>
                Our clinic combines cutting-edge technology with a warm, welcoming environment. 
                From the moment you walk in, you'll experience our commitment to excellence 
                and personalized care.
              </p>
              <div className="about-features">
                <div className="about-feature">
                  <span className="check">✓</span>
                  <span>FDA Approved Treatments</span>
                </div>
                <div className="about-feature">
                  <span className="check">✓</span>
                  <span>Advanced Technology</span>
                </div>
                <div className="about-feature">
                  <span className="check">✓</span>
                  <span>Affordable Pricing</span>
                </div>
                <div className="about-feature">
                  <span className="check">✓</span>
                  <span>Flexible Payment Plans</span>
                </div>
              </div>
              <button className="about-btn" onClick={onSignupClick}>
                Get Started Today
              </button>
            </div>
            <div className="about-visual">
              {/* Doctor Profiles */}
              <div className="doctors-showcase">
                <div className="doctor-card">
                  <div className="doctor-image">
                    <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="60" cy="60" r="60" fill="#f5f0e6"/>
                      <circle cx="60" cy="45" r="22" fill="#c4a35a"/>
                      <ellipse cx="60" cy="95" rx="35" ry="25" fill="#c4a35a"/>
                      <path d="M45 38C45 33 50 30 60 30C70 30 75 33 75 38C75 43 70 46 60 46C50 46 45 43 45 38Z" fill="#a88b45"/>
                    </svg>
                  </div>
                  <div className="doctor-info">
                    <h4>Dr. Name</h4>
                    <p>Dermatologist</p>
                    <span className="doctor-specialty">Skin & Hair Expert</span>
                  </div>
                </div>
                <div className="doctor-card">
                  <div className="doctor-image">
                    <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="60" cy="60" r="60" fill="#f5f0e6"/>
                      <circle cx="60" cy="45" r="22" fill="#c4a35a"/>
                      <ellipse cx="60" cy="95" rx="35" ry="25" fill="#c4a35a"/>
                      <path d="M45 38C45 33 50 30 60 30C70 30 75 33 75 38C75 43 70 46 60 46C50 46 45 43 45 38Z" fill="#a88b45"/>
                    </svg>
                  </div>
                  <div className="doctor-info">
                    <h4>Dr. Name</h4>
                    <p>Dermatologist</p>
                    <span className="doctor-specialty">Laser Specialist</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="testimonials-section">
        <div className="section-container">
          <div className="section-header">
            <span className="section-tag">Testimonials</span>
            <h2 className="section-title">What Our <span className="highlight">Patients Say</span></h2>
          </div>
          
          <div className="testimonials-grid">
            <div className="testimonial-card">
              <div className="testimonial-rating">★★★★★</div>
              <p className="testimonial-text">
                "He explain very well when I get treatment.after delivery my skin was too dull n darker. So just want to consult that's y meet him. In one visit I got positive result.
                It's reasonable not too expensive. Thank u ."
              </p>
              <div className="testimonial-author">
                <div className="author-avatar">S</div>
                <div className="author-info">
                  <span className="author-name">Tejashri Patil</span>
                  <span className="author-treatment">Skin Treatment</span>
                </div>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-rating">★★★★★</div>
              <p className="testimonial-text">
                "The over all experience has been great. I went for hair treatment/checkup because of too much dandruff. Because most of the times your head and shoulders wont do much unless you treat the root cause. Was ordered tests, and thought the medical treatment would be recurring and costly. But wasn't."
              </p>
              <div className="testimonial-author">
                <div className="author-avatar">P</div>
                <div className="author-info">
                  <span className="author-name">Ishan bhojak</span>
                  <span className="author-treatment">Hair Treatment</span>
                </div>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-rating">★★★★★</div>
              <p className="testimonial-text">
                "BI visited Skinora Clinic for acne and pimples after feeling completely fed up with the treatments I had tried earlier and the money I had spent. However, I’m now seeing much better results. I can’t say my acne is 100% gone yet since the treatment is still ongoing, but the overall progress has been very positive. I’m hopeful that my skin will be clear in the next few sessions.

As part of the treatment, I had a chemical peel and a medi-facial. The services are reasonably priced, and the clinic maintains proper precautions and cleanliness."
              </p>
              <div className="testimonial-author">
                <div className="author-avatar">A</div>
                <div className="author-info">
                  <span className="author-name">Bhagyashree Patil</span>
                  <span className="author-treatment"> Treatment</span>
                </div>
              </div>
            </div>
          </div>

          <div className="testimonials-cta">
            <a 
              href="https://www.google.com/maps/place/SKINORA+CLINIC/@18.6239392,73.7294921,906m/data=!3m1!1e3!4m8!3m7!1s0x3bc2bb98fe7704ed:0x41f5f0e05225597f!8m2!3d18.6239341!4d73.732067!9m1!1b1!16s%2Fg%2F11xgnw7mmp?entry=ttu&g_ep=EgoyMDI2MDIxMS4wIKXMDSoASAFQAw%3D%3D" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="google-reviews-btn"
            >
              <span className="google-icon">⭐</span>
              <div className="btn-content">
                <span className="btn-title">View All Reviews on Google</span>
                <span className="btn-subtitle">Read more patient experiences</span>
              </div>
              <span className="btn-arrow">→</span>
            </a>
            <a 
              href="https://www.google.com/maps/place/SKINORA+CLINIC/@18.6239392,73.7294921,906m/data=!3m1!1e3!4m8!3m7!1s0x3bc2bb98fe7704ed:0x41f5f0e05225597f!8m2!3d18.6239341!4d73.732067!9m1!1b1!16s%2Fg%2F11xgnw7mmp?entry=ttu&g_ep=EgoyMDI2MDIxMS4wIKXMDSoASAFQAw%3D%3D" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="write-review-btn"
            >
              <span>✏️</span> Write a Review
            </a>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-section-content">
          <h2>Ready to Transform Your Look?</h2>
          <p>Book a free consultation today and let our experts guide you to your best self.</p>
          <div className="cta-section-buttons">
            <button className="cta-primary" onClick={onBookingClick}>
              Book  Consultation
            </button>
            <button className="cta-secondary" onClick={onSignupClick}>
              Create Account
            </button>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="contact-section">
        <div className="section-container">
          <div className="contact-content">
            <div className="contact-info">
              <span className="section-tag">Contact Us</span>
              <h2 className="section-title">Visit Our <span className="highlight">Clinic</span></h2>
              
              <div className="contact-details">
                <div className="contact-item">
                  <span className="contact-icon">📍</span>
                  <div>
                    <h4>Address</h4>
                    <p>Shop no B231, 18 latitude Mall, Gaikwad nagar, kate wasti,punawale,pune,PCMC<br />, Maharashtra 411033</p>
                  </div>
                </div>
                <div className="contact-item">
                  <span className="contact-icon">📞</span>
                  <div>
                    <h4>Phone</h4>
                    <p>+91 9764949469, +91 8147229156</p>
                  </div>
                </div>
                <div className="contact-item">
                  <span className="contact-icon">✉️</span>
                  <div>
                    <h4>Email</h4>
                    {/* <p>info@skinora.in</p> */}
                  </div>
                </div>
                <div className="contact-item">
                  <span className="contact-icon">🕐</span>
                  <div>
                    <h4>Working Hours</h4>
                    <p><b>Mon - Sun:</b> Morning: 10:00 AM - 1:00 PM<br />Evening: 6:00 PM - 9:30 PM</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="contact-form-container">
              <form className="contact-form" onSubmit={(e) => e.preventDefault()}>
                <h3>Send us a Message</h3>
                <div className="form-row">
                  <input type="text" placeholder="Your Name" />
                  <input type="email" placeholder="Your Email" />
                </div>
                <input type="tel" placeholder="Phone Number" />
                <select>
                  <option value="">Select Service</option>
                  <option value="skin">Skin Treatment</option>
                  <option value="hair">Hair Treatment</option>
                  <option value="laser">Laser Treatment</option>
                  <option value="other">Other</option>
                </select>
                <textarea placeholder="Your Message" rows="4"></textarea>
                <button type="submit" className="submit-btn">Send Message</button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-container">
          <div className="footer-main">
            <div className="footer-brand">
              <div className="footer-logo">
                <span className="logo-icon">✦</span>
                <span className="logo-text">SKINORA</span>
              </div>
              <p>Your trusted partner in beauty and wellness. Experience the difference with our premium dermatology and aesthetic treatments.</p>
              <div className="footer-social">
                <a href="#" className="social-link">📘</a>
                <a href="#" className="social-link">📸</a>
                <a href="#" className="social-link">🐦</a>
                <a href="#" className="social-link">💼</a>
              </div>
            </div>
            
            <div className="footer-links">
              <div className="footer-column">
                <h4>Quick Links</h4>
                <ul>
                  <li onClick={() => scrollToSection('home')}>Home</li>
                  <li onClick={() => scrollToSection('services')}>Services</li>
                  <li onClick={() => scrollToSection('about')}>About Us</li>
                  <li onClick={() => scrollToSection('contact')}>Contact</li>
                </ul>
              </div>
              <div className="footer-column">
                <h4>Services</h4>
                <ul>
                  <li>Skin Treatments</li>
                  <li>Hair Treatments</li>
                  <li>Laser Procedures</li>
                  <li>Anti-Aging</li>
                </ul>
              </div>
              <div className="footer-column">
                <h4>Legal</h4>
                <ul>
                  <li>Privacy Policy</li>
                  <li>Terms of Service</li>
                  <li>Refund Policy</li>
                  <li>FAQ</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="footer-bottom">
            <p>© 2024 Skinora Clinic. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

