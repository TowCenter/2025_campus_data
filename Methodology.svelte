<script>
  // Placeholder chart data - replace with your actual methodology charts
  let chartPlaceholder = true;
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

      <section>
        <h3>Data Quality and Limitations</h3>
        <p>
          While we strive for comprehensive coverage, several limitations should be noted:
        </p>
        <ul>
          <li>Coverage is limited to publicly available institutional communications</li>
          <li>Some institutions may remove or edit communications after initial publication</li>
          <li>Classification of institutional stance involves interpretive judgment</li>
          <li>Small institutions with limited web presence may be underrepresented</li>
        </ul>
        <p>
          We welcome feedback on our methodology and encourage researchers to contact us with questions 
          or suggestions for improvement.
        </p>
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
    </div>
  </div>
</div>

<style>
  .methodology-container {
    background: white;
  }

  .container {
    max-width: 800px;
    margin: 0 auto;
    padding: 0 2rem;
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