const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.secretkey || process.env.OPENAI_API_KEY_NEW || process.env.OPENAI_API_KEY
});

class AIServices {
    constructor() {
        this.initialized = !!(process.env.secretkey || process.env.OPENAI_API_KEY_NEW || process.env.OPENAI_API_KEY);
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







    // Generate page content for website builder AI assistant
    async generatePageContent(prompt, currentPage, pageType) {
        if (!this.initialized) {
            throw new Error('AI services not available - missing API key');
        }

        try {
            const aiPrompt = `You are an expert web designer creating beautiful photography websites. 
            
            Current page type: ${pageType}
            Current page content: ${currentPage || 'Empty page'}
            
            User request: ${prompt}
            
            Create beautiful, professional HTML content for this photography website page that fulfills the user's request. Include:
            - Modern, elegant styling appropriate for photography
            - Responsive design elements
            - Professional typography and spacing
            - Color schemes that work well for photography (warm, neutral tones)
            - Interactive elements where appropriate
            - Make all text elements contenteditable="true" and onclick="showTextToolbar(this)" for editing
            - Use placeholder images from unsplash for any photos needed
            - Professional photography-focused design aesthetic
            
            Return ONLY the HTML content for the page body (no html, head, or body tags), styled with inline CSS.
            Focus on premium, luxury aesthetics that photographers would love.
            
            Important: All text should be editable by clicking, and images should be replaceable.`;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert web designer specializing in luxury photography websites. Create beautiful, modern HTML with inline CSS styling.'
                    },
                    {
                        role: 'user',
                        content: aiPrompt
                    }
                ],
                max_tokens: 3000,
                temperature: 0.7
            });

            return completion.choices[0].message.content;

        } catch (error) {
            console.error('AI Services: Error generating page content:', error);
            throw new Error('Failed to generate page content: ' + error.message);
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

Please format your response as JSON with a packages array containing: name, description, features, priceAnchor, urgency, guarantee`;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "You are a pricing psychology expert for service businesses. Create pricing copy that justifies value and encourages immediate action. Always respond with valid JSON format."
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

    // Business Management AI Functions
    async generateBlogPost(prompt) {
        if (!this.initialized) {
            throw new Error('AI services not available - OpenAI API key required');
        }

        try {
            const blogPrompt = `Create a comprehensive, engaging blog post for a photography business:

Topic/Prompt: ${prompt}

Generate a well-structured blog post with:
1. Compelling headline
2. Engaging introduction hook
3. 3-4 main sections with subheadings
4. Practical tips or insights
5. Strong conclusion with call-to-action
6. SEO-friendly content

Target audience: Potential photography clients and industry peers
Tone: Professional yet personable, expertise-driven
Length: 800-1200 words
Focus: Provide genuine value while subtly showcasing expertise

Format the response as HTML with proper headings (h2, h3), paragraphs, and bullet points where appropriate.`;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "You are an expert content marketing specialist for photography businesses. Create valuable, engaging blog content that establishes authority and attracts clients."
                    },
                    {
                        role: "user",
                        content: blogPrompt
                    }
                ],
                max_tokens: 2000,
                temperature: 0.7
            });

            return completion.choices[0].message.content;
        } catch (error) {
            console.error('AI Services: Error generating blog post:', error);
            
            // Provide specific error messages for common issues
            if (error.message && error.message.includes('insufficient permissions')) {
                throw new Error('OpenAI API key has insufficient permissions. Please create a new API key with full access at platform.openai.com');
            }
            if (error.message && error.message.includes('quota')) {
                throw new Error('OpenAI API quota exceeded. Please add credits to your OpenAI account.');
            }
            
            throw new Error('Failed to generate blog post: ' + error.message);
        }
    }

    async generateSocialPost(platform, prompt, includeHashtags) {
        if (!this.initialized) {
            throw new Error('AI services not available - OpenAI API key required');
        }

        try {
            const platformGuidelines = {
                instagram: "Visual-focused, 2-3 sentences, engaging and aspirational",
                facebook: "Community-oriented, can be longer, storytelling approach",
                twitter: "Concise, under 280 characters, trending and timely",
                linkedin: "Professional, industry insights, value-driven content",
                tiktok: "Trendy, fun, engaging hook, younger audience"
            };

            const guidelines = platformGuidelines[platform] || "Engaging and platform-appropriate";
            const hashtagInstruction = includeHashtags ? "Include 5-10 relevant hashtags" : "No hashtags needed";

            const socialPrompt = `Create a ${platform} post for a photography business:

Topic/Prompt: ${prompt}
Platform: ${platform}
Guidelines: ${guidelines}
Hashtags: ${hashtagInstruction}

Requirements:
- Engaging and platform-appropriate tone
- Clear value proposition
- Encourages engagement (likes, comments, shares)
- Includes subtle call-to-action
- Photography business context

Keep it authentic and avoid overly sales-focused language.`;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "You are a social media expert specializing in photography business marketing. Create engaging posts that build community and attract clients."
                    },
                    {
                        role: "user",
                        content: socialPrompt
                    }
                ],
                max_tokens: 300,
                temperature: 0.8
            });

            return completion.choices[0].message.content;
        } catch (error) {
            console.error('AI Services: Error generating social post:', error);
            throw new Error('Failed to generate social post: ' + error.message);
        }
    }

    async generateQuickIdeas(prompt) {
        if (!this.initialized) {
            throw new Error('AI services not available - OpenAI API key required');
        }

        try {
            const ideasPrompt = `Generate 8-10 creative, actionable ideas for a photography business:

Topic/Request: ${prompt}

Requirements:
- Practical and implementable
- Creative but realistic
- Specific to photography business context
- Varied approaches and perspectives
- Each idea should be 1-2 sentences
- Mix of short-term and long-term ideas

Please format your response as JSON with an "ideas" array containing the list of ideas.`;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "You are a creative business consultant specializing in photography businesses. Generate diverse, actionable ideas that photographers can implement. Always respond with valid JSON format."
                    },
                    {
                        role: "user",
                        content: ideasPrompt
                    }
                ],
                response_format: { type: "json_object" },
                max_tokens: 800,
                temperature: 0.9
            });

            const result = JSON.parse(completion.choices[0].message.content);
            return result.ideas || [];
        } catch (error) {
            console.error('AI Services: Error generating ideas:', error);
            throw new Error('Failed to generate ideas: ' + error.message);
        }
    }

    // BADASS MODE: Advanced AI Content Generation
    async generateAdvancedContent(contentType, context, userPrompt) {
        if (!this.initialized) {
            throw new Error('AI services not available - OpenAI API key required');
        }

        try {
            let systemPrompt = "";
            let maxTokens = 2000;
            let temperature = 0.8;

            switch (contentType) {
                case 'website_edit':
                    systemPrompt = "You are an expert web designer and developer specializing in photography portfolios. You modify HTML to fulfill user requests while maintaining professional aesthetics and functionality. Always return valid JSON with newHTML, description, and improvements fields.";
                    maxTokens = 4000;
                    temperature = 0.7;
                    break;
                case 'website_analysis':
                    systemPrompt = "You are an expert web designer and UX analyst specializing in photography portfolios. Analyze websites for design, usability, and conversion optimization. Always return valid JSON with analysis, strengths, improvements, suggestions, and priority fields.";
                    maxTokens = 2000;
                    temperature = 0.4;
                    break;
                case 'complete-website':
                    systemPrompt = "You are a world-class web designer and copywriter who creates stunning, conversion-optimized photography websites. Generate complete HTML structure with inline CSS that's modern, responsive, and professional.";
                    maxTokens = 4000;
                    break;
                case 'sales-copy':
                    systemPrompt = "You are a direct-response copywriter specializing in high-converting photography business copy. Write compelling, emotional copy that drives bookings and sales.";
                    temperature = 0.9;
                    break;
                case 'seo-content':
                    systemPrompt = "You are an SEO expert and content strategist. Generate SEO-optimized content that ranks well while maintaining authentic, engaging copy for photography businesses.";
                    break;
                case 'social-media':
                    systemPrompt = "You are a social media expert for photography businesses. Create engaging, shareable content that builds brand awareness and drives inquiries.";
                    temperature = 0.9;
                    break;
                case 'email-templates':
                    systemPrompt = "You are an email marketing specialist for photography businesses. Create professional, conversion-focused email templates for client communication.";
                    break;
                case 'brand-strategy':
                    systemPrompt = "You are a brand strategist specializing in photography businesses. Create comprehensive brand positioning and messaging strategies.";
                    break;
                default:
                    systemPrompt = "You are an expert content creator specializing in photography business marketing and web content.";
            }

            let prompt;
            
            if (contentType === 'website_edit') {
                prompt = `You are modifying a photography website. Here's the current HTML:

${context.currentHTML}

USER REQUEST: "${context.request}"
WEBSITE TYPE: ${context.websiteType}

Modify the HTML to fulfill the user's request while maintaining:
1. All existing wb-editable classes for interactive editing
2. Professional photography portfolio aesthetics
3. Responsive design principles
4. Clean, modern styling
5. Proper HTML structure

IMPORTANT GUIDELINES:
- Keep all wb-editable classes intact
- Maintain existing JavaScript event handlers
- Use inline styles for modifications
- Ensure mobile responsiveness
- Focus on photography best practices
- Add subtle animations where appropriate
- Improve typography, spacing, and visual hierarchy
- Use professional color schemes
- Maintain accessibility standards

CRITICAL: Return ONLY valid JSON with no additional text or formatting. Structure:
{
  "newHTML": "escaped HTML content here - use proper JSON string escaping",
  "description": "brief description of changes made",
  "improvements": ["list", "of", "specific", "improvements"]
}

IMPORTANT: Properly escape all quotes, newlines, and special characters in the HTML string. Do not include any markdown formatting or code blocks in your response.`;
            } else if (contentType === 'website_analysis') {
                prompt = `Analyze this photography portfolio website:

${context.currentHTML}

Please provide a comprehensive analysis covering:
1. DESIGN STRENGTHS: What's working well visually
2. AREAS FOR IMPROVEMENT: Specific design issues to address
3. USER EXPERIENCE: Navigation and usability assessment
4. VISUAL HIERARCHY: Typography, spacing, and layout analysis
5. BRAND PERCEPTION: How professional/trustworthy it appears
6. MOBILE RESPONSIVENESS: Potential mobile issues
7. CONVERSION OPTIMIZATION: Elements that could drive bookings

Based on your analysis, provide 3-5 specific, actionable suggestions for improvement.

CRITICAL: Return ONLY valid JSON with no additional text or formatting. Structure:
{
  "analysis": "comprehensive analysis summary (2-3 sentences)",
  "strengths": ["list", "of", "current", "strengths"],
  "improvements": ["list", "of", "improvement", "areas"],
  "suggestions": ["actionable suggestion 1", "actionable suggestion 2", "etc"],
  "priority": "highest priority improvement recommendation"
}

IMPORTANT: Do not include any markdown formatting or code blocks in your response.`;
            } else {
                prompt = `Context: ${JSON.stringify(context)}
User Request: ${userPrompt}

Create professional, high-quality content that exceeds expectations. Be creative, detailed, and ensure everything is optimized for conversion and user experience.`;
            }

            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: systemPrompt
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                response_format: { type: "json_object" },
                max_tokens: maxTokens,
                temperature: temperature
            });

            // For website_edit and website_analysis, return the parsed JSON directly
            if (contentType === 'website_edit' || contentType === 'website_analysis') {
                try {
                    const rawContent = completion.choices[0].message.content;
                    console.log('Raw OpenAI response length:', rawContent.length);
                    
                    // Clean the response to ensure valid JSON
                    let cleanedContent = rawContent.trim();
                    
                    // Remove any markdown code blocks if present
                    cleanedContent = cleanedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');
                    
                    // Parse the JSON
                    const parsedResult = JSON.parse(cleanedContent);
                    
                    // Validate required fields for website_edit
                    if (contentType === 'website_edit') {
                        if (!parsedResult.newHTML) {
                            throw new Error('Missing newHTML field in response');
                        }
                        // Clean up any potential HTML escaping issues
                        if (typeof parsedResult.newHTML === 'string') {
                            parsedResult.newHTML = parsedResult.newHTML.replace(/\\"/g, '"').replace(/\\n/g, '\n');
                        }
                    }
                    
                    return parsedResult;
                } catch (parseError) {
                    console.error('JSON Parse Error:', parseError.message);
                    console.error('Raw content preview:', completion.choices[0].message.content.substring(0, 500));
                    
                    // Return a fallback response for website_edit
                    if (contentType === 'website_edit') {
                        return {
                            newHTML: context.currentHTML || '<div>Error: Could not process request</div>',
                            description: 'AI response parsing failed - returned original content',
                            improvements: ['Please try again with a simpler request']
                        };
                    } else {
                        return {
                            analysis: 'Analysis could not be completed due to response format error',
                            strengths: [],
                            improvements: ['Please try the analysis again'],
                            suggestions: ['Retry the request'],
                            priority: 'Fix response parsing'
                        };
                    }
                }
            }

            return {
                content: completion.choices[0].message.content,
                contentType: contentType,
                generatedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('Advanced AI content generation error:', error);
            throw new Error('Failed to generate advanced content: ' + error.message);
        }
    }

    // BADASS MODE: AI Code Generation for Custom Components
    async generateCustomComponent(componentType, requirements, designStyle) {
        if (!this.initialized) {
            throw new Error('AI services not available - OpenAI API key required');
        }

        try {
            const prompt = `Generate a custom HTML/CSS/JS component for a photography website:

Component Type: ${componentType}
Requirements: ${requirements}
Design Style: ${designStyle}

Create a complete, self-contained component with:
1. Modern, responsive HTML structure
2. Beautiful CSS styling with animations/interactions
3. Vanilla JavaScript functionality (if needed)
4. Mobile-first responsive design
5. Professional typography and spacing
6. Smooth transitions and hover effects

The component should be production-ready and visually stunning. Include inline styles and scripts for easy integration.

Return as JSON with keys: html, css, javascript, description, usage`;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "You are a senior frontend developer and designer specializing in creating stunning, interactive web components for photography websites. Your code is clean, modern, and follows best practices."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                response_format: { type: "json_object" },
                max_tokens: 3000,
                temperature: 0.7
            });

            return JSON.parse(completion.choices[0].message.content);
        } catch (error) {
            console.error('Custom component generation error:', error);
            throw new Error('Failed to generate custom component: ' + error.message);
        }
    }

    // BADASS MODE: AI Website Optimization
    async optimizeWebsite(websiteHTML, optimizationType) {
        if (!this.initialized) {
            throw new Error('AI services not available - OpenAI API key required');
        }

        try {
            const optimizationPrompts = {
                'conversion': 'Optimize this website for maximum conversion rate. Focus on compelling CTAs, trust signals, social proof, and user psychology.',
                'speed': 'Optimize this website for page speed and performance. Minimize CSS/JS, optimize images, and improve loading times.',
                'seo': 'Optimize this website for search engines. Improve meta tags, heading structure, semantic HTML, and keyword optimization.',
                'accessibility': 'Optimize this website for accessibility. Ensure WCAG compliance, proper alt tags, keyboard navigation, and screen reader compatibility.',
                'mobile': 'Optimize this website for mobile devices. Improve responsive design, touch interactions, and mobile user experience.',
                'visual': 'Optimize this website\'s visual design. Improve typography, spacing, colors, and overall aesthetic appeal.'
            };

            const prompt = `${optimizationPrompts[optimizationType] || optimizationPrompts.conversion}

Current Website HTML:
${websiteHTML}

Provide the optimized HTML with improvements. Explain what changes were made and why.

Return as JSON with keys: optimizedHTML, changes, explanation, improvementScore`;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "You are a website optimization expert specializing in photography businesses. You understand conversion psychology, technical SEO, performance optimization, and modern web standards."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                response_format: { type: "json_object" },
                max_tokens: 4000,
                temperature: 0.6
            });

            return JSON.parse(completion.choices[0].message.content);
        } catch (error) {
            console.error('Website optimization error:', error);
            throw new Error('Failed to optimize website: ' + error.message);
        }
    }

    // BADASS MODE: AI Content Strategy Generator
    async generateContentStrategy(businessInfo, goals, timeframe) {
        if (!this.initialized) {
            throw new Error('AI services not available - OpenAI API key required');
        }

        try {
            const prompt = `Create a comprehensive content strategy for a photography business:

Business Info: ${JSON.stringify(businessInfo)}
Goals: ${goals}
Timeframe: ${timeframe}

Generate a detailed content strategy including:
1. Content calendar with specific post ideas
2. Blog post topics and headlines
3. Social media strategy
4. Email marketing campaigns
5. Website content updates
6. SEO keyword strategy
7. Content performance metrics to track

Make it actionable and specific to photography businesses.

Return as JSON with keys: strategy, contentCalendar, blogTopics, socialMedia, emailCampaigns, seoKeywords, metrics`;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "You are a digital marketing strategist specializing in photography businesses. You understand the unique challenges and opportunities in the photography industry."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                response_format: { type: "json_object" },
                max_tokens: 3500,
                temperature: 0.7
            });

            return JSON.parse(completion.choices[0].message.content);
        } catch (error) {
            console.error('Content strategy generation error:', error);
            throw new Error('Failed to generate content strategy: ' + error.message);
        }
    }

    // BADASS MODE: Smart Page Builder
    async generateSmartPage(pageType, requirements, existingContent) {
        if (!this.initialized) {
            throw new Error('AI services not available - OpenAI API key required');
        }

        try {
            const prompt = `Generate a complete, professional webpage for a photography business:

Page Type: ${pageType}
Requirements: ${requirements}
Existing Content Context: ${existingContent}

Create a complete HTML page with:
1. Modern, responsive design with inline CSS
2. Professional typography and spacing
3. High-converting layout optimized for photography businesses
4. SEO-friendly structure with proper headings and meta elements
5. Call-to-action buttons and contact forms where appropriate
6. Image placeholders with proper alt text
7. Smooth animations and hover effects
8. Mobile-first responsive design

Return as JSON with keys: html, title, description, features, seoTags`;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "You are a professional web developer and UX designer specializing in photography business websites. You create beautiful, converting pages that drive bookings and showcase photography work professionally."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                response_format: { type: "json_object" },
                max_tokens: 4000,
                temperature: 0.7
            });

            return JSON.parse(completion.choices[0].message.content);
        } catch (error) {
            console.error('Smart page generation error:', error);
            throw new Error('Failed to generate smart page: ' + error.message);
        }
    }

    // Optimize entire website based on specific criteria
    async optimizeWebsite(websiteHTML, optimizationType) {
        if (!this.initialized) {
            throw new Error('AI services not available - missing API key');
        }

        try {
            const optimizations = {
                'performance': 'Focus on loading speed, image optimization, code efficiency, and user experience',
                'seo': 'Enhance search engine optimization with better meta tags, content structure, and keywords',
                'conversion': 'Improve conversion rates with better calls-to-action, layout, and persuasive copy',
                'accessibility': 'Make the website more accessible with proper ARIA labels, contrast, and navigation',
                'mobile': 'Optimize for mobile devices with responsive design improvements'
            };

            const optimizationFocus = optimizations[optimizationType] || optimizations['performance'];

            const prompt = `As a web development expert, optimize this photography website for ${optimizationType}:

            CURRENT WEBSITE HTML:
            ${websiteHTML}

            OPTIMIZATION FOCUS: ${optimizationFocus}

            Please provide:
            1. Optimized HTML with inline CSS improvements
            2. Specific optimizations made
            3. Performance/usability improvements
            4. SEO enhancements (if applicable)
            5. Accessibility improvements (if applicable)

            Maintain all existing wb-editable classes and JavaScript functionality.
            Focus on professional photography aesthetics.

            Return as JSON: { optimizedHTML, improvements, performanceGains, seoEnhancements, accessibilityFixes }`;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system", 
                        content: "You are a web optimization expert specializing in photography websites. Provide practical, measurable improvements."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                response_format: { type: "json_object" },
                max_tokens: 4000,
                temperature: 0.6
            });

            return JSON.parse(completion.choices[0].message.content);
        } catch (error) {
            console.error('AI Services: Error optimizing website:', error);
            throw new Error('Failed to optimize website: ' + error.message);
        }
    }

    // Generate custom components based on requirements
    async generateCustomComponent(componentType, requirements, designStyle) {
        if (!this.initialized) {
            throw new Error('AI services not available - missing API key');
        }

        try {
            const prompt = `Create a custom ${componentType} component for a photography website:

            Requirements: ${requirements}
            Design Style: ${designStyle}

            Generate a professional, interactive component with:
            1. Complete HTML structure with inline CSS
            2. JavaScript functionality if needed
            3. Mobile-responsive design
            4. Photography-focused aesthetics
            5. wb-editable classes for text elements
            6. Professional color scheme and typography

            Component types could include: gallery, slider, testimonial, pricing table, contact form, portfolio grid, etc.

            Return as JSON: { componentHTML, description, features, instructions }`;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "You are a frontend component expert specializing in photography websites. Create beautiful, functional components."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                response_format: { type: "json_object" },
                max_tokens: 3500,
                temperature: 0.7
            });

            return JSON.parse(completion.choices[0].message.content);
        } catch (error) {
            console.error('AI Services: Error generating custom component:', error);
            throw new Error('Failed to generate custom component: ' + error.message);
        }
    }

    // Generate content strategy for photography business
    async generateContentStrategy(businessInfo, goals, timeframe) {
        if (!this.initialized) {
            throw new Error('AI services not available - missing API key');
        }

        try {
            const prompt = `Create a comprehensive content strategy for a photography business:

            Business Information: ${JSON.stringify(businessInfo)}
            Goals: ${JSON.stringify(goals)}
            Timeframe: ${timeframe}

            Generate a detailed strategy including:
            1. Content pillars and themes
            2. Content calendar outline
            3. Social media strategy
            4. Blog post topics and frequency
            5. Client engagement strategies
            6. Brand voice and messaging
            7. Content creation workflow
            8. Performance metrics to track

            Focus on practical, actionable strategies that can be implemented immediately.

            Return as JSON: { contentPillars, calendar, socialStrategy, blogTopics, engagement, brandVoice, workflow, metrics }`;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "You are a digital marketing strategist specializing in photography businesses. Create actionable, results-driven strategies."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                response_format: { type: "json_object" },
                max_tokens: 3000,
                temperature: 0.7
            });

            return JSON.parse(completion.choices[0].message.content);
        } catch (error) {
            console.error('AI Services: Error generating content strategy:', error);
            throw new Error('Failed to generate content strategy: ' + error.message);
        }
    }
}

module.exports = { AIServices };