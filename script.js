const axios = require("axios");
const cheerio = require("cheerio");

async function scrapeLinkedInJob(url) {
  // Extract job ID from URL
  const jobIdMatch = url.match(/currentJobId=(\d+)/);
  if (!jobIdMatch) {
    console.error("Could not extract job ID from URL");
    process.exit(1);
  }
  const jobId = jobIdMatch[1];

  // Use LinkedIn's public guest job view endpoint
  const publicJobUrl = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`;

  try {
    console.log("Fetching job details...");
    console.log("Job ID:", jobId);

    // Make request with proper headers to appear like a browser
    const response = await axios.get(publicJobUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
      timeout: 15000,
    });

    // Parse HTML with cheerio
    const $ = cheerio.load(response.data);

    // Extract job details
    const jobTitle =
      $(".top-card-layout__title").text().trim() ||
      $("h1").first().text().trim() ||
      "N/A";

    const company =
      $(".top-card-layout__second-subline a").first().text().trim() ||
      $(".topcard__org-name-link").text().trim() ||
      "N/A";

    const location =
      $(".topcard__flavor--bullet").first().text().trim() ||
      $(".top-card-layout__second-subline").text().split("·")[1]?.trim() ||
      "N/A";

    // Extract job description
    const descriptionHtml =
      $(".show-more-less-html__markup").html() ||
      $(".description__text").html() ||
      $('[class*="description"]').first().html() ||
      "";

    // Convert HTML to clean text
    const $desc = cheerio.load(descriptionHtml);
    const description = $desc
      .text()
      .trim()
      .replace(/\s+/g, " ")
      .replace(/\n\s*\n/g, "\n");

    if (!description) {
      throw new Error("Could not extract job description");
    }

    // Extract additional details
    const employmentType =
      $(".description__job-criteria-text").eq(0).text().trim() || "N/A";
    const seniorityLevel =
      $(".description__job-criteria-text").eq(1).text().trim() || "N/A";

    const jobUrl = `https://www.linkedin.com/jobs/view/${jobId}`;

    // Output results
    console.log("\n" + "=".repeat(70));
    console.log("JOB DETAILS");
    console.log("=".repeat(70));
    console.log(`Title:           ${jobTitle}`);
    console.log(`Company:         ${company}`);
    console.log(`Location:        ${location}`);
    console.log(`Employment Type: ${employmentType}`);
    console.log(`Seniority Level: ${seniorityLevel}`);
    console.log(`Job ID:          ${jobId}`);
    console.log(`URL:             ${jobUrl}`);
    console.log("=".repeat(70));
    console.log("\nJOB DESCRIPTION:\n");
    console.log(description);
    console.log("\n" + "=".repeat(70));

    // Save to file
    const fs = require("fs");
    const outputFile = `job-${jobId}.txt`;
    const output = `Title: ${jobTitle}
Company: ${company}
Location: ${location}
Employment Type: ${employmentType}
Seniority Level: ${seniorityLevel}
URL: ${jobUrl}

DESCRIPTION:
${description}`;

    fs.writeFileSync(outputFile, output);
    console.log(`\n✓ Job description saved to: ${outputFile}`);

    // Also save as JSON
    const jsonOutput = {
      jobId,
      title: jobTitle,
      company,
      location,
      employmentType,
      seniorityLevel,
      url: jobUrl,
      description,
      scrapedAt: new Date().toISOString(),
    };

    const jsonFile = `job-${jobId}.json`;
    fs.writeFileSync(jsonFile, JSON.stringify(jsonOutput, null, 2));
    console.log(`✓ JSON data saved to: ${jsonFile}`);

    return jsonOutput;
  } catch (error) {
    if (error.response?.status === 404) {
      console.error(
        "\n❌ Job not found. The posting may have been removed or the ID is incorrect.",
      );
    } else if (error.response?.status === 429) {
      console.error(
        "\n❌ Rate limited. Please wait a few minutes before trying again.",
      );
    } else {
      console.error("\n❌ Error fetching job:", error.message);
    }

    console.log("\nTroubleshooting tips:");
    console.log("1. Verify the job ID is correct");
    console.log("2. Check if the job posting is still active");
    console.log("3. Try again in a few minutes if rate limited");

    throw error;
  }
}

// Usage
const args = process.argv.slice(2);
const linkedInUrl = args[0];

if (!linkedInUrl) {
  console.error('Usage: node script.js "<LinkedIn Job URL>"');
  console.error("\nExample:");
  console.error(
    '  node script.js "https://www.linkedin.com/jobs/collections/recommended/?currentJobId=4338745874"',
  );
  console.error("\nOr provide just the job ID:");
  console.error('  node script.js "4338745874"');
  process.exit(1);
}

// Handle both full URLs and just job IDs
const finalUrl = linkedInUrl.includes("linkedin.com")
  ? linkedInUrl
  : `https://www.linkedin.com/jobs/view/${linkedInUrl}`;

console.log("Starting LinkedIn job scraper (API-based, no auth required)...\n");

scrapeLinkedInJob(finalUrl)
  .then(() => {
    console.log("\n✓ Script completed successfully!");
    process.exit(0);
  })
  .catch(() => process.exit(1));
