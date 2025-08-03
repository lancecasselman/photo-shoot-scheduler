const OpenAI = require('openai');

class AIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // Token pricing per 1000 tokens (approximate)
    this.tokenRates = {
      'gpt-4o': 0.005, // $0.005 per 1k tokens
      'gpt-3.5-turbo': 0.001 // $0.001 per 1k tokens
    };
  }

  // Estimate tokens for text (rough approximation: 1 token ≈ 4 characters)
  estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }

  // Calculate credits needed (1 credit = 1 token)
  calculateCreditsNeeded(prompt, expectedResponse = 500) {
    const promptTokens = this.estimateTokens(prompt);
    const responseTokens = expectedResponse;
    return promptTokens + responseTokens;
  }

  async generateContent(userId, prompt, requestType = 'content_generation', model = 'gpt-4o') {
    try {
      // Calculate credits needed
      const creditsNeeded = this.calculateCreditsNeeded(prompt);
      
      // Import Pool for database operations
      const { Pool } = require('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL
      });

      // Check current credits
      const userResult = await pool.query('SELECT ai_credits FROM users WHERE id = $1', [userId]);
      const currentCredits = userResult.rows[0]?.ai_credits || 0;
      
      if (currentCredits < creditsNeeded) {
        return {
          success: false,
          error: 'insufficient_credits',
          message: 'Insufficient AI credits. Please purchase more credits to continue.',
          creditsNeeded,
          currentCredits
        };
      }

      // Deduct credits
      await pool.query('UPDATE users SET ai_credits = ai_credits - $1 WHERE id = $2', [creditsNeeded, userId]);
      
      // Log the usage
      await pool.query(`
        INSERT INTO ai_credit_transactions (user_id, amount, operation, details, created_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [userId, -creditsNeeded, requestType, prompt]);

      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const response = await this.openai.chat.completions.create({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are a professional website content writer specializing in photography businesses. Create engaging, SEO-friendly content that converts visitors into clients. Be specific, compelling, and authentic. No placeholder text or generic content.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      const content = response.choices[0].message.content;
      const actualTokensUsed = response.usage?.total_tokens || creditsNeeded;

      return {
        success: true,
        content,
        tokensUsed: actualTokensUsed,
        creditsUsed: creditsNeeded
      };

    } catch (error) {
      console.error('AI Service Error:', error);
      return {
        success: false,
        error: 'ai_error',
        message: 'Failed to generate content. Please try again.',
        details: error.message
      };
    }
  }

  async generatePageContent(userId, businessInfo) {
    const prompt = `Create professional website content for a photography business with these details:
    
Business Name: ${businessInfo.businessName || 'Photography Studio'}
Specialty: ${businessInfo.specialty || 'Professional Photography'}
Location: ${businessInfo.location || 'Local Area'}
Years of Experience: ${businessInfo.experience || '5+ years'}
Style: ${businessInfo.style || 'Artistic and Professional'}
Target Clients: ${businessInfo.targetClients || 'Couples, Families, Professionals'}
Unique Selling Points: ${businessInfo.uniquePoints || 'Personalized service, high-quality results'}

Generate content for these sections:
1. Hero headline (compelling, under 10 words)
2. Hero subtext (2-3 sentences explaining value proposition)
3. About section (2-3 paragraphs about the photographer/business)
4. Services overview (3-4 key services with brief descriptions)
5. Call-to-action text (encouraging booking/contact)

Return as JSON with keys: heroHeadline, heroSubtext, aboutSection, servicesOverview, callToAction`;

    return this.generateContent(userId, prompt, 'page_generation');
  }

  async improveSEO(userId, currentContent, targetKeywords) {
    const prompt = `Improve this photography website content for SEO while maintaining natural readability:

Current Content: "${currentContent}"
Target Keywords: ${targetKeywords.join(', ')}

Rewrite to:
1. Naturally incorporate target keywords
2. Improve readability and engagement
3. Add compelling calls-to-action
4. Optimize for local SEO if applicable
5. Maintain authentic, professional tone

Return only the improved content, no explanations.`;

    return this.generateContent(userId, prompt, 'seo_optimization');
  }

  async generateImageAltText(userId, imageDescription, context) {
    const prompt = `Create SEO-optimized alt text for this photography website image:

Image Description: "${imageDescription}"
Page Context: "${context}"

Requirements:
- Under 125 characters
- Descriptive and specific
- Include relevant keywords naturally
- Professional photography terminology
- Accessible for screen readers

Return only the alt text, no quotes or explanations.`;

    return this.generateContent(userId, prompt, 'alt_text_generation');
  }

  async getCreditBundles() {
    return [
      { credits: 1000, price: 1.00, popular: false },
      { credits: 5000, price: 4.99, popular: false },
      { credits: 10000, price: 8.99, popular: true },
      { credits: 25000, price: 19.99, popular: false },
      { credits: 50000, price: 34.99, popular: false }
    ];
  }
}

module.exports = { aiService: new AIService() };