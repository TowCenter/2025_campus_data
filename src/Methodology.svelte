<script>
  // Placeholder chart data - replace with your actual methodology charts
  let chartPlaceholder = true;
  
  // Contact form state
  let contactForm = {
    name: '',
    email: '',
    message: ''
  };
  let submitting = false;
  let submitSuccess = false;
  
  async function handleContactSubmit() {
    submitting = true;
    submitSuccess = false;
    
    // Simulate form submission - replace with your actual endpoint
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // TODO: Replace with actual form submission logic
    // Example: await fetch('/api/contact', { method: 'POST', body: JSON.stringify(contactForm) })
    
    submitting = false;
    submitSuccess = true;
    
    // Reset form
    contactForm = { name: '', email: '', message: '' };
    
    // Hide success message after 3 seconds
    setTimeout(() => {
      submitSuccess = false;
    }, 3000);
  }
</script>

<div class="methodology-container">
  <div class="container">
    <div class="content-wrapper">
      <h2>Methodology</h2>
      
      <section class="intro">
        <p class="lead">
          This dataset tracks institutional responses from U.S. universities to campus protests, 
          federal policy changes, and administrative actions from October 2023 through the present. 
          Our methodology combines automated web scraping with manual verification to ensure accuracy 
          and completeness.
        </p>
      </section>

      <section>
        <h3>Data Collection</h3>
        <p>
          We monitor official communications from over 500 U.S. colleges and universities, including 
          public statements, press releases, and administrative announcements. Our scraping infrastructure 
          checks institutional websites daily for new content related to campus protests, federal compliance, 
          funding issues, and legal actions.
        </p>
        <p>
          Each document is tagged with metadata including the institution name, publication date, document 
          type, and topic classifications. Our classification system uses a combination of keyword matching 
          and manual review to categorize responses into the following areas:
        </p>
        <ul>
          <li><strong>Protest-related:</strong> Institutional responses to on-campus demonstrations and activism</li>
          <li><strong>Government-related:</strong> Communications addressing federal policies or actions</li>
          <li><strong>Funding-related:</strong> Announcements concerning changes in federal or state funding</li>
          <li><strong>Lawsuit-related:</strong> Legal actions involving the institution</li>
        </ul>
      </section>

      <section>
        <h3>Classification Process</h3>
        <p>
          We employ a multi-stage classification process to ensure accurate categorization:
        </p>
        <ol>
          <li><strong>Automated Initial Classification:</strong> Documents are first processed using keyword 
          matching and natural language processing to identify relevant topics.</li>
          <li><strong>LLM-Assisted Analysis:</strong> Selected documents undergo analysis by large language 
          models to extract nuanced positioning and sentiment.</li>
          <li><strong>Manual Review:</strong> A team of researchers reviews flagged documents to verify 
          classifications and resolve ambiguous cases.</li>
        </ol>
      </section>

      <section class="chart-section">
        <h3>Distribution of Response Types</h3>
        <div class="chart-placeholder">
          <p><em>Chart placeholder: Bar chart showing distribution of response types across institutions</em></p>
          <div class="placeholder-box">
            [Interactive chart will be embedded here showing response type distribution]
          </div>
        </div>
      </section>

      <section class="chart-section">
        <h3>Geographic Coverage</h3>
        <div class="chart-placeholder">
          <p><em>Map showing distribution of monitored institutions across the United States</em></p>
          <div class="placeholder-box" id="map-container">
            [US map with institutional locations will be displayed here]
          </div>
        </div>
      </section>

      <section class="chart-section">
        <h3>Daily Response Volume</h3>
        <div class="chart-placeholder">
          <p><em>Area chart showing number of institutional responses per day</em></p>
          <div class="placeholder-box" id="area-chart-container">
            [Area chart will be displayed here]
          </div>
        </div>
      </section>

      <section class="chart-section">
        <h3>Timeline of Data Collection</h3>
        <div class="chart-placeholder">
          <p><em>Chart placeholder: Timeline showing volume of institutional responses over time</em></p>
          <div class="placeholder-box">
            [Interactive timeline chart will be embedded here]
          </div>
        </div>
      </section>

      <section>
        <h3>Updates and Maintenance</h3>
        <p>
          This dataset is updated weekly with newly collected institutional communications. Each update 
          includes new documents as well as any corrections or reclassifications identified through our 
          ongoing review process. The "Last Updated" timestamp on the data download page reflects the 
          most recent update.
        </p>
      </section>

      <section>
        <h3>Citation and Usage</h3>
        <p>
          Researchers using this dataset should cite it as follows:
        </p>
        <blockquote>
          [Your Name], "University Response Tracker Dataset," Tow Center for Digital Journalism, 
          Columbia University, 2024-2025. Available at: [URL]
        </blockquote>
        <p>
          This data is made available for research and journalistic purposes. For questions about usage 
          or permissions, please contact the Tow Center for Digital Journalism.
        </p>
      </section>

      <section class="contact-section">
        <h3>Contact Us</h3>
        <p>
          [Add your description here - e.g., "Have questions about the dataset? Want to report an issue? 
          We'd love to hear from you."]
        </p>
        
        <form class="contact-form" on:submit|preventDefault={handleContactSubmit}>
          <div class="form-group">
            <label for="name">Name</label>
            <input type="text" id="name" bind:value={contactForm.name} placeholder="Your name" />
          </div>
          
          <div class="form-group">
            <label for="email">Email</label>
            <input type="email" id="email" bind:value={contactForm.email} placeholder="your@email.com" />
          </div>
          
          <div class="form-group">
            <label for="message">Message</label>
            <textarea id="message" bind:value={contactForm.message} placeholder="Your message..." rows="5"></textarea>
          </div>
          
          <button type="submit" class="submit-btn" disabled={submitting}>
            {#if submitting}
              <span class="btn-spinner"></span>
              Sending...
            {:else}
              Send Message
            {/if}
          </button>

          {#if submitSuccess}
            <p class="success-message">✓ Message sent successfully!</p>
          {/if}
        </form>
      </section>
    </div>
  </div>
</div>

<style>
  .methodology-container {
    background: white;
  }

  .container {
    max-width: 750px;
    margin: 0 auto;
    padding: 0 3rem;
  }

  .content-wrapper {
    padding: 2rem 0 4rem;
  }

  h2 {
    font-size: 2.5rem;
    margin: 0 0 2rem;
    color: #D6613A;
    font-weight: 400;
    font-family: "EB Garamond", serif;
  }

  h3 {
    font-size: 1.6rem;
    margin: 2.5rem 0 1rem;
    color: #222;
    font-weight: 400;
    font-family: "EB Garamond", serif;
  }

  section {
    margin-bottom: 2.5rem;
  }

  .intro {
    margin-bottom: 3rem;
  }

  .lead {
    font-size: 1.25rem;
    line-height: 1.8;
    color: #333;
    font-family: "EB Garamond", serif;
  }

  p {
    margin: 1rem 0;
    line-height: 1.8;
    color: #444;
    font-size: 1.05rem;
  }

  ul, ol {
    margin: 1rem 0;
    padding-left: 2rem;
    line-height: 1.9;
  }

  li {
    margin: 0.7rem 0;
    color: #444;
    font-size: 1.05rem;
  }

  strong {
    color: #222;
    font-weight: 600;
  }

  blockquote {
    background: #E4F3F1;
    border-left: 4px solid #66C2C2;
    padding: 1.25rem 1.5rem;
    margin: 1.5rem 0;
    font-style: italic;
    color: #333;
  }

  .chart-section {
    margin: 3rem 0;
  }

  .chart-placeholder {
    margin: 1.5rem 0;
  }

  .placeholder-box {
    background: #ffffff;
    border: 2px dashed #ddd;
    border-radius: 4px;
    padding: 3rem;
    text-align: center;
    color: #999;
    font-style: italic;
    margin-top: 1rem;
    font-family: "Helvetica Neue", sans-serif;
    font-size: 0.95rem;
  }

  /* Contact Form */
  .contact-section {
    margin-top: 4rem;
    padding-top: 3rem;
    border-top: 2px solid #e0e0e0;
  }

  .contact-form {
    max-width: 600px;
    margin: 2rem auto 0;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: #222;
    font-family: "Helvetica Neue", sans-serif;
    font-size: 0.95rem;
  }

  .form-group input,
  .form-group textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #dee2e6;
    border-radius: 4px;
    font-size: 1rem;
    font-family: "EB Garamond", serif;
    transition: border-color 0.2s;
  }

  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: #D6613A;
    box-shadow: 0 0 0 3px rgba(214, 97, 58, 0.1);
  }

  .form-group textarea {
    resize: vertical;
    min-height: 120px;
  }

  .submit-btn {
    background: white;
    color: #D6613A;
    border: 2px solid #D6613A;
    border-radius: 4px;
    padding: 0.75rem 2.5rem;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: "Helvetica Neue", sans-serif;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .submit-btn:hover:not(:disabled) {
    background: #D6613A;
    color: white;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    transform: translateY(-1px);
  }

  .submit-btn:active:not(:disabled) {
    transform: translateY(0);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .submit-btn:disabled {
    background: white;
    border-color: #ccc;
    color: #ccc;
    cursor: not-allowed;
    box-shadow: none;
  }

  .btn-spinner {
    border: 2px solid #D6613A;
    border-top: 2px solid transparent;
    border-radius: 50%;
    width: 16px;
    height: 16px;
    animation: spin 0.8s linear infinite;
    display: inline-block;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .success-message {
    color: #28a745;
    font-family: "Helvetica Neue", sans-serif;
    margin-top: 1rem;
    font-weight: 500;
  }

  @media (max-width: 768px) {
    .container {
      padding: 0 1.5rem;
    }

    h2 {
      font-size: 2rem;
    }

    h3 {
      font-size: 1.4rem;
    }

    .lead {
      font-size: 1.15rem;
    }

    p, li {
      font-size: 1rem;
    }
  }
</style>