const OpenAI = require('openai');

class BlogGenerator {
    constructor() {
        if (!process.env.OPENAI_API_KEY) {
            console.warn('WARNING: OpenAI API key not configured - blog generation disabled');
            this.openai = null;
        } else {
            this.openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY
            });
            console.log('✅ Blog Generator initialized with OpenAI');
        }
    }

    /**
     * Generate a blog post for photographers
     */
    async generateBlogPost({
        topic,
        style = 'professional',
        length = 'medium',
        keywords = [],
        photographyType = 'general',
        tone = 'informative'
    }) {
        if (!this.openai) {
            throw new Error('OpenAI API not configured');
        }

        try {
            // Determine word count based on length
            const wordCounts = {
                short: '300-500',
                medium: '600-800',
                long: '1000-1500'
            };

            const wordCount = wordCounts[length] || wordCounts.medium;

            // Build the prompt
            const prompt = `Create a professional blog post for a photography website about "${topic}".

Photography Type: ${photographyType}
Writing Style: ${style}
Tone: ${tone}
Target Length: ${wordCount} words
${keywords.length > 0 ? `SEO Keywords to include naturally: ${keywords.join(', ')}` : ''}

Requirements:
1. Write in a ${tone} tone suitable for a professional photography business
2. Include an engaging title
3. Structure with clear sections using markdown headers
4. Add a compelling introduction that hooks readers
5. Include practical tips or insights relevant to ${photographyType} photography
6. End with a call-to-action for photography services
7. Make it SEO-friendly while maintaining natural flow
8. Format in markdown for easy web display

Generate a complete, publication-ready blog post.`;

            const response = await this.openai.chat.completions.create({
                model: 'gpt-4o', // Latest model as specified in blueprint
                messages: [
                    {
                        role: 'system',
                        content: 'You are a professional content writer specializing in photography and visual arts. Create engaging, informative blog posts that help photographers grow their business and connect with clients.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 2000
            });

            const content = response.choices[0].message.content;

            // Extract title and content
            const lines = content.split('\n');
            let title = lines[0].replace(/^#\s*/, '').trim();
            
            // If first line isn't a title, create one
            if (!title || title.length > 100) {
                title = topic;
            }

            // Parse and enhance the content
            const enhancedContent = this.enhanceContent(content);

            return {
                success: true,
                title: title,
                content: enhancedContent,
                wordCount: enhancedContent.split(/\s+/).length,
                metadata: {
                    topic,
                    style,
                    length,
                    keywords,
                    photographyType,
                    tone,
                    generatedAt: new Date().toISOString()
                }
            };

        } catch (error) {
            console.error('Error generating blog post:', error);
            throw new Error(`Failed to generate blog post: ${error.message}`);
        }
    }

    /**
     * Generate blog post ideas based on photography type
     */
    async generateBlogIdeas(photographyType = 'general', count = 10) {
        if (!this.openai) {
            throw new Error('OpenAI API not configured');
        }

        try {
            const prompt = `Generate ${count} engaging blog post ideas for a ${photographyType} photography business website.

Requirements:
1. Ideas should be relevant to potential clients
2. Mix educational, inspirational, and business-focused topics
3. Include seasonal and trending topics
4. Consider SEO potential
5. Make them specific and actionable

Format: Return as a JSON array with objects containing:
- title: The blog post title
- description: A brief 1-2 sentence description
- keywords: Array of 3-5 relevant SEO keywords
- category: One of [tips, showcase, behind-the-scenes, education, business, seasonal]`;

            const response = await this.openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a content strategist for photography businesses. Generate engaging, client-focused blog ideas.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.8
            });

            const result = JSON.parse(response.choices[0].message.content);
            
            return {
                success: true,
                ideas: result.ideas || result.blogIdeas || [],
                photographyType
            };

        } catch (error) {
            console.error('Error generating blog ideas:', error);
            throw new Error(`Failed to generate blog ideas: ${error.message}`);
        }
    }

    /**
     * Generate SEO metadata for a blog post
     */
    async generateSEOMetadata(title, content) {
        if (!this.openai) {
            throw new Error('OpenAI API not configured');
        }

        try {
            const prompt = `Generate SEO metadata for this blog post:

Title: ${title}
Content Preview: ${content.substring(0, 500)}...

Generate:
1. Meta description (150-160 characters)
2. 5-8 relevant SEO keywords
3. 3-5 hashtags for social media
4. Open Graph description (200 characters)
5. Twitter card description (200 characters)

Format as JSON with keys: metaDescription, keywords, hashtags, ogDescription, twitterDescription`;

            const response = await this.openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.3
            });

            const metadata = JSON.parse(response.choices[0].message.content);
            
            return {
                success: true,
                ...metadata
            };

        } catch (error) {
            console.error('Error generating SEO metadata:', error);
            throw new Error(`Failed to generate SEO metadata: ${error.message}`);
        }
    }

    /**
     * Enhance content with formatting and structure
     */
    enhanceContent(content) {
        // Add photographer-specific enhancements
        let enhanced = content;

        // Ensure proper markdown formatting
        enhanced = enhanced.replace(/^#+\s+/gm, (match) => '\n' + match);
        
        // Add emphasis to key photography terms
        const photographyTerms = [
            'composition', 'lighting', 'exposure', 'aperture', 'ISO',
            'shutter speed', 'depth of field', 'bokeh', 'golden hour',
            'rule of thirds', 'leading lines', 'framing', 'perspective'
        ];

        photographyTerms.forEach(term => {
            const regex = new RegExp(`\\b(${term})\\b`, 'gi');
            enhanced = enhanced.replace(regex, (match, p1, offset, string) => {
                // Don't emphasize if already in markdown formatting
                const before = string.substring(Math.max(0, offset - 2), offset);
                const after = string.substring(offset + match.length, offset + match.length + 2);
                if (before.includes('*') || after.includes('*') || before.includes('_') || after.includes('_')) {
                    return match;
                }
                return `*${match}*`;
            });
        });

        // Add call-to-action if missing
        if (!enhanced.toLowerCase().includes('contact') && !enhanced.toLowerCase().includes('book')) {
            enhanced += '\n\n---\n\n**Ready to capture your special moments?** Contact us today to discuss your photography needs and book your session.';
        }

        return enhanced.trim();
    }

    /**
     * Generate image alt text for blog posts
     */
    async generateImageAltText(imageDescription, context) {
        if (!this.openai) {
            throw new Error('OpenAI API not configured');
        }

        try {
            const response = await this.openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'user',
                        content: `Generate SEO-friendly alt text for an image in a photography blog post.
                        
Image description: ${imageDescription}
Blog context: ${context}

Requirements:
1. Be descriptive but concise (under 125 characters)
2. Include relevant keywords naturally
3. Describe what's in the image
4. Be accessible for screen readers

Return only the alt text, no additional formatting.`
                    }
                ],
                temperature: 0.3,
                max_tokens: 50
            });

            return {
                success: true,
                altText: response.choices[0].message.content.trim()
            };

        } catch (error) {
            console.error('Error generating alt text:', error);
            return {
                success: false,
                altText: imageDescription
            };
        }
    }
}

module.exports = BlogGenerator;