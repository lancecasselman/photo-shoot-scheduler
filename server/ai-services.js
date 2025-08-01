const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

class AIServices {
    constructor() {
        this.initialized = !!process.env.OPENAI_API_KEY;
        if (!this.initialized) {
            console.warn('AI Services: OpenAI API key not found - AI features disabled');
        } else {
            console.log('AI Services: OpenAI initialized successfully');
        }
    }

    // Generate website copy based on photography style and business info
    async generateWebsiteCopy(photographyStyle, businessInfo) {
        if (!this.initialized) {
            throw new Error('AI services not available - OpenAI API key required');
        }

        try {
            const prompt = `Generate professional website copy for a photographer with the following details:

Photography Style: ${photographyStyle}
Business Info: ${JSON.stringify(businessInfo)}

Please provide:
1. Hero section headline (powerful, emotional, under 60 characters)
2. Hero section subtitle (2-3 sentences about their unique approach)
3. About section (2-3 paragraphs about their story and expertise)
4. Services description (concise overview of what they offer)
5. Call-to-action text (compelling action phrase under 30 characters)

Write in a professional but warm tone that connects emotionally with potential clients. Focus on the value and experience they provide, not just technical skills. Make it conversion-focused.

Return as JSON with keys: heroHeadline, heroSubtitle, aboutText, servicesText, ctaText`;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
                messages: [
                    {
                        role: "system",
                        content: "You are an expert copywriter specializing in photography business websites. Generate compelling, professional copy that converts visitors into clients. Always return valid JSON."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                response_format: { type: "json_object" },
                max_tokens: 1500,
                temperature: 0.7
            });

            const result = JSON.parse(completion.choices[0].message.content);
            
            // Validate required fields
            const requiredFields = ['heroHeadline', 'heroSubtitle', 'aboutText', 'servicesText', 'ctaText'];
            for (const field of requiredFields) {
                if (!result[field]) {
                    throw new Error(`Missing required field: ${field}`);
                }
            }
            
            return result;
        } catch (error) {
            console.error('AI Services: Error generating website copy:', error);
            
            // Return fallback content on error
            return {
                heroHeadline: `Capturing Life's Most Precious Moments`,
                heroSubtitle: `Professional ${photographyStyle} photography that tells your unique story with artistry and emotion.`,
                aboutText: `Welcome to ${businessInfo.name || 'our studio'}, where we believe every moment deserves to be preserved beautifully. With ${businessInfo.experience || 'years of'} experience in ${photographyStyle} photography, we specialize in creating timeless images that capture the essence of who you are.`,
                servicesText: `We offer comprehensive ${photographyStyle} photography services tailored to your unique needs and vision.`,
                ctaText: 'Book Your Session'
            };
        }
    }

    // Analyze uploaded images and generate descriptions/tags
    async analyzePhotos(imageUrls) {
        if (!this.initialized) {
            throw new Error('AI services not available - missing API key');
        }

        try {
            const results = [];

            for (const imageUrl of imageUrls.slice(0, 5)) { // Limit to 5 images to manage costs
                const completion = await openai.chat.completions.create({
                    model: "gpt-4o",
                    messages: [
                        {
                            role: "system",
                            content: "You are a professional photography expert. Analyze photos and provide detailed, SEO-friendly descriptions and relevant tags."
                        },
                        {
                            role: "user",
                            content: [
                                {
                                    type: "text",
                                    text: `Analyze this photography image and provide:
1. A compelling description for the website (2-3 sentences)
2. Photography style/genre classification
3. Technical observations (lighting, composition, mood)
4. SEO-friendly tags (comma-separated)
5. Suggested portfolio category

Return as JSON with keys: description, style, technical, tags, category`
                                },
                                {
                                    type: "image_url",
                                    image_url: {
                                        url: imageUrl
                                    }
                                }
                            ]
                        }
                    ],
                    response_format: { type: "json_object" },
                    max_tokens: 800
                });

                const analysis = JSON.parse(completion.choices[0].message.content);
                results.push({
                    imageUrl,
                    ...analysis
                });
            }

            return results;
        } catch (error) {
            console.error('AI Services: Error analyzing photos:', error);
            throw new Error('Failed to analyze photos: ' + error.message);
        }
    }

    // Generate layout suggestions based on content and photography style
    async suggestLayout(contentType, photographyStyle, businessGoals) {
        if (!this.initialized) {
            throw new Error('AI services not available - missing API key');
        }

        try {
            const prompt = `As a web design expert specializing in photography websites, suggest optimal layouts for:

Content Type: ${contentType}
Photography Style: ${photographyStyle}
Business Goals: ${businessGoals}

Provide specific recommendations for:
1. Layout structure (sections and their order)
2. Visual hierarchy suggestions
3. Color palette recommendations
4. Typography pairing
5. Content organization tips

Focus on layouts that convert visitors into clients and showcase photography effectively.

Return as JSON with keys: structure, hierarchy, colors, typography, organization`;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "You are an expert web designer specializing in photography portfolios and business websites. Your recommendations should be practical and conversion-focused."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                response_format: { type: "json_object" },
                max_tokens: 1200,
                temperature: 0.8
            });

            return JSON.parse(completion.choices[0].message.content);
        } catch (error) {
            console.error('AI Services: Error generating layout suggestions:', error);
            throw new Error('Failed to generate layout suggestions: ' + error.message);
        }
    }

    // Generate SEO-optimized content
    async generateSEOContent(businessInfo, targetKeywords, pageType) {
        if (!this.initialized) {
            throw new Error('AI services not available - missing API key');
        }

        try {
            const prompt = `Generate SEO-optimized content for a photography website:

Business: ${JSON.stringify(businessInfo)}
Target Keywords: ${targetKeywords.join(', ')}
Page Type: ${pageType}

Provide:
1. SEO-optimized title tag (50-60 chars)
2. Meta description (150-160 chars)
3. H1 heading
4. H2 subheadings (3-4 suggestions)
5. Body content (2-3 paragraphs, naturally incorporating keywords)
6. Image alt text suggestions
7. Internal linking opportunities

Return as JSON with keys: title, metaDescription, h1, h2Headings, bodyContent, altTexts, internalLinks`;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "You are an SEO expert specializing in photography business websites. Create content that ranks well and converts visitors into clients."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                response_format: { type: "json_object" },
                max_tokens: 1500,
                temperature: 0.6
            });

            return JSON.parse(completion.choices[0].message.content);
        } catch (error) {
            console.error('AI Services: Error generating SEO content:', error);
            throw new Error('Failed to generate SEO content: ' + error.message);
        }
    }

    // Generate testimonials and social proof content
    async generateTestimonials(photographyStyle, services, clientTypes) {
        if (!this.initialized) {
            throw new Error('AI services not available - missing API key');
        }

        try {
            const prompt = `Generate realistic testimonials for a photographer specializing in:

Photography Style: ${photographyStyle}
Services: ${services.join(', ')}
Client Types: ${clientTypes.join(', ')}

Create 5 diverse testimonials that:
- Sound authentic and specific
- Mention specific aspects of the experience
- Include emotional responses
- Vary in length and tone
- Reference different services/situations

Return as JSON array with keys: name, testimonial, service, rating (1-5)`;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "You are a marketing expert who creates authentic-sounding testimonials that highlight specific benefits and emotional outcomes of working with photographers."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                response_format: { type: "json_object" },
                max_tokens: 1200,
                temperature: 0.8
            });

            return JSON.parse(completion.choices[0].message.content);
        } catch (error) {
            console.error('AI Services: Error generating testimonials:', error);
            throw new Error('Failed to generate testimonials: ' + error.message);
        }
    }

    // Smart content suggestions based on user behavior and industry trends
    async getContentSuggestions(currentContent, photographyNiche, targetAudience) {
        if (!this.initialized) {
            throw new Error('AI services not available - missing API key');
        }

        try {
            const prompt = `Analyze current website content and provide improvement suggestions:

Current Content: ${JSON.stringify(currentContent)}
Photography Niche: ${photographyNiche}
Target Audience: ${targetAudience}

Provide actionable suggestions for:
1. Content gaps to fill
2. Messaging improvements
3. Call-to-action optimization
4. Trust-building elements
5. Conversion rate improvements
6. Content freshness ideas

Return as JSON with keys: contentGaps, messagingImprovements, ctaOptimization, trustElements, conversionTips, freshContent`;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "You are a conversion optimization expert for photography websites. Provide specific, actionable recommendations that increase bookings."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                response_format: { type: "json_object" },
                max_tokens: 1500,
                temperature: 0.7
            });

            return JSON.parse(completion.choices[0].message.content);
        } catch (error) {
            console.error('AI Services: Error getting content suggestions:', error);
            throw new Error('Failed to get content suggestions: ' + error.message);
        }
    }

    // Generate pricing copy that converts
    async generatePricingCopy(services, pricePoints, targetMarket) {
        if (!this.initialized) {
            throw new Error('AI services not available - missing API key');
        }

        try {
            const prompt = `Create compelling pricing copy for photography services:

Services: ${JSON.stringify(services)}
Price Points: ${JSON.stringify(pricePoints)}
Target Market: ${targetMarket}

Generate:
1. Package names (creative, memorable)
2. Package descriptions (value-focused)
3. Feature lists (benefit-oriented)
4. Pricing anchors (why this price makes sense)
5. Urgency/scarcity elements
6. Guarantee/risk reversal copy

Return as JSON with packages array containing: name, description, features, priceAnchor, urgency, guarantee`;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "You are a pricing psychology expert for service businesses. Create pricing copy that justifies value and encourages immediate action."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                response_format: { type: "json_object" },
                max_tokens: 1500,
                temperature: 0.7
            });

            return JSON.parse(completion.choices[0].message.content);
        } catch (error) {
            console.error('AI Services: Error generating pricing copy:', error);
            throw new Error('Failed to generate pricing copy: ' + error.message);
        }
    }
}

module.exports = { AIServices };