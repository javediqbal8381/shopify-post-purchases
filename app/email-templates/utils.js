import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Load and populate an email template with dynamic data
 * @param {string} templateName - Name of the template file (without .html extension)
 * @param {Object} data - Object containing template variables
 * @returns {string} - Populated HTML string
 */
export function getEmailTemplate(templateName, data) {
  try {
    // Read the HTML template file
    const templatePath = join(process.cwd(), 'app', 'email-templates', `${templateName}.html`);
    let template = readFileSync(templatePath, 'utf-8');
    
    // Replace all placeholders with actual data
    Object.keys(data).forEach(key => {
      const placeholder = `{{${key}}}`;
      const value = data[key] || '';
      template = template.split(placeholder).join(value);
    });
    
    return template;
  } catch (error) {
    console.error(`Error loading email template ${templateName}:`, error);
    throw new Error(`Failed to load email template: ${templateName}`);
  }
}
