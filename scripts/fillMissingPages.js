#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Node.js script to automatically create missing template pages
 * This script creates about.html, portfolio.html, and contact.html files
 * for photography website templates if they don't already exist.
 */

// Template content for missing pages
const pageTemplates = {
  'about.html': `<section class="about-section">
  <div class="container">
    <h1>About Me</h1>
    <p>Hello! I'm a passionate photographer dedicated to capturing life's most meaningful moments.</p>
  </div>
</section>`,

  'portfolio.html': `<section class="portfolio-section">
  <div class="container">
    <h1>My Work</h1>
    <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
      <img src="/assets/placeholder1.jpg" alt="Sample" />
      <img src="/assets/placeholder2.jpg" alt="Sample" />
      <img src="/assets/placeholder3.jpg" alt="Sample" />
    </div>
  </div>
</section>`,

  'contact.html': `<section class="contact-section">
  <div class="container">
    <h1>Get in Touch</h1>
    <form class="space-y-4">
      <input type="text" placeholder="Your Name" class="input" />
      <input type="email" placeholder="Your Email" class="input" />
      <textarea placeholder="Your Message" class="input h-32"></textarea>
      <button type="submit" class="btn">Send Message</button>
    </form>
  </div>
</section>`
};

// Required pages that should exist in each template
const requiredPages = ['about.html', 'portfolio.html', 'contact.html'];

/**
 * Creates missing template files in a directory
 * @param {string} templateDir - Path to the template directory
 * @param {string} templateName - Name of the template
 */
function createMissingPages(templateDir, templateName) {
  console.log(`\n🔍 Checking template: ${templateName}`);
  
  let filesCreated = 0;
  let filesSkipped = 0;

  requiredPages.forEach(page => {
    const filePath = path.join(templateDir, page);
    
    if (fs.existsSync(filePath)) {
      console.log(`  ✔️  Already exists: ${templateName}/${page}`);
      filesSkipped++;
    } else {
      try {
        fs.writeFileSync(filePath, pageTemplates[page], 'utf8');
        console.log(`  SUCCESS: Created: ${templateName}/${page}`);
        filesCreated++;
      } catch (error) {
        console.log(`  ❌ Failed to create: ${templateName}/${page} - ${error.message}`);
      }
    }
  });

  return { created: filesCreated, skipped: filesSkipped };
}

/**
 * Main function to process all templates
 */
function main() {
  console.log('Starting Starting Template Page Generator...\n');
  
  const templatesDir = path.join(process.cwd(), 'templates');
  
  // Check if templates directory exists
  if (!fs.existsSync(templatesDir)) {
    console.log('📁 Templates directory not found. Creating it...');
    
    try {
      fs.mkdirSync(templatesDir, { recursive: true });
      console.log('SUCCESS: Created templates directory');
    } catch (error) {
      console.log(`❌ Failed to create templates directory: ${error.message}`);
      return;
    }
  }

  // Check if templates directory is empty and create example templates
  const templateEntries = fs.readdirSync(templatesDir);
  const templateDirs = templateEntries.filter(entry => {
    const fullPath = path.join(templatesDir, entry);
    return fs.statSync(fullPath).isDirectory();
  });

  if (templateDirs.length === 0) {
    console.log('📝 No template directories found. Creating example templates...');
    
    // Create example template directories based on our current templates
    const exampleTemplates = [
      'classic-elegance',
      'modern-minimalist', 
      'vintage-charm',
      'romantic-moments',
      'elegant-studio',
      'creative-portfolio',
      'bold-statement',
      'event-showcase',
      'nature-inspired',
      'urban-edge'
    ];

    exampleTemplates.forEach(templateName => {
      const templatePath = path.join(templatesDir, templateName);
      
      try {
        fs.mkdirSync(templatePath, { recursive: true });
        console.log(`  📂 Created template directory: ${templateName}`);
      } catch (error) {
        console.log(`  ❌ Failed to create template directory ${templateName}: ${error.message}`);
      }
    });

    // Re-read the directory
    const newTemplateEntries = fs.readdirSync(templatesDir);
    templateDirs.push(...newTemplateEntries.filter(entry => {
      const fullPath = path.join(templatesDir, entry);
      return fs.statSync(fullPath).isDirectory();
    }));
  }

  // Process each template directory
  let totalCreated = 0;
  let totalSkipped = 0;

  templateDirs.forEach(templateName => {
    const templatePath = path.join(templatesDir, templateName);
    const stats = createMissingPages(templatePath, templateName);
    totalCreated += stats.created;
    totalSkipped += stats.skipped;
  });

  // Summary
  console.log('\n📊 Summary:');
  console.log(`  SUCCESS: Files created: ${totalCreated}`);
  console.log(`  ✔️  Files skipped (already exist): ${totalSkipped}`);
  console.log(`  📁 Templates processed: ${templateDirs.length}`);
  
  if (totalCreated > 0) {
    console.log('\n🎉 Template page generation completed successfully!');
  } else {
    console.log('\n✨ All template pages already exist. Nothing to do!');
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { createMissingPages, pageTemplates, requiredPages };