// Block Library for Advanced Website Builder

class BlockLibrary {
    constructor() {
        this.blocks = {
            layout: [
                {
                    id: 'hero',
                    name: 'Hero Section',
                    icon: '🎯',
                    description: 'Large header with background image and call-to-action',
                    category: 'layout',
                    template: {
                        type: 'hero',
                        content: {
                            title: 'Professional Photography',
                            subtitle: 'Capturing your most precious moments with artistic vision',
                            backgroundImage: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1200&h=600&fit=crop',
                            buttonText: 'View Portfolio',
                            buttonLink: '#portfolio',
                            overlayOpacity: 0.4
                        },
                        styles: {
                            textAlign: 'center',
                            minHeight: '70vh',
                            color: 'white',
                            backgroundAttachment: 'fixed'
                        }
                    }
                },
                {
                    id: 'two-column',
                    name: 'Two Column',
                    icon: '📰',
                    description: 'Side-by-side content layout',
                    category: 'layout',
                    template: {
                        type: 'two-column',
                        content: {
                            leftColumn: {
                                type: 'content',
                                content: '<h3>About My Work</h3><p>Professional photography services specializing in portraits, events, and commercial work.</p>'
                            },
                            rightColumn: {
                                type: 'image',
                                src: 'https://images.unsplash.com/photo-1542038784456-1ea8e8eba4f6?w=500&h=400&fit=crop',
                                alt: 'Photography equipment'
                            }
                        },
                        styles: {
                            gap: '40px',
                            alignItems: 'center'
                        }
                    }
                },
                {
                    id: 'three-column',
                    name: 'Three Column',
                    icon: '📊',
                    description: 'Triple column layout for services or features',
                    category: 'layout',
                    template: {
                        type: 'three-column',
                        content: {
                            columns: [
                                {
                                    icon: '📸',
                                    title: 'Portrait Photography',
                                    description: 'Professional headshots and portrait sessions'
                                },
                                {
                                    icon: '💒',
                                    title: 'Wedding Photography',
                                    description: 'Capturing your special day with artistic vision'
                                },
                                {
                                    icon: '🎉',
                                    title: 'Event Photography',
                                    description: 'Professional coverage of corporate and social events'
                                }
                            ]
                        },
                        styles: {
                            gap: '30px',
                            textAlign: 'center'
                        }
                    }
                }
            ],
            content: [
                {
                    id: 'heading',
                    name: 'Heading',
                    icon: '📝',
                    description: 'Large title text with customizable styling',
                    category: 'content',
                    template: {
                        type: 'heading',
                        content: {
                            text: 'Your Heading Here',
                            level: 'h2',
                            alignment: 'left'
                        },
                        styles: {
                            fontSize: '2.5rem',
                            fontWeight: 'bold',
                            margin: '30px 0 20px 0',
                            lineHeight: '1.2'
                        }
                    }
                },
                {
                    id: 'paragraph',
                    name: 'Paragraph',
                    icon: '📄',
                    description: 'Body text content with rich formatting options',
                    category: 'content',
                    template: {
                        type: 'paragraph',
                        content: {
                            text: 'Add your content here. This paragraph block supports rich text formatting and allows you to share detailed information about your photography services, experience, and approach.',
                            alignment: 'left'
                        },
                        styles: {
                            fontSize: '1.1rem',
                            lineHeight: '1.7',
                            margin: '20px 0',
                            maxWidth: '800px'
                        }
                    }
                },
                {
                    id: 'quote',
                    name: 'Quote',
                    icon: '💬',
                    description: 'Highlighted testimonial or quote',
                    category: 'content',
                    template: {
                        type: 'quote',
                        content: {
                            text: 'The photographs captured the essence of our special day perfectly. Professional, creative, and absolutely stunning results.',
                            author: 'Sarah & Michael Johnson',
                            position: 'Wedding Clients'
                        },
                        styles: {
                            fontSize: '1.3rem',
                            fontStyle: 'italic',
                            textAlign: 'center',
                            padding: '40px',
                            backgroundColor: '#f8f9fa',
                            borderLeft: '4px solid var(--primary-color)'
                        }
                    }
                },
                {
                    id: 'list',
                    name: 'List',
                    icon: '📋',
                    description: 'Bullet points or numbered list',
                    category: 'content',
                    template: {
                        type: 'list',
                        content: {
                            items: [
                                'Professional portrait sessions',
                                'Wedding and event photography',
                                'Commercial and business photography',
                                'Photo editing and retouching',
                                'Digital gallery delivery'
                            ],
                            listType: 'bullet',
                            title: 'Photography Services'
                        },
                        styles: {
                            fontSize: '1.1rem',
                            lineHeight: '1.8',
                            padding: '20px 0'
                        }
                    }
                }
            ],
            media: [
                {
                    id: 'image',
                    name: 'Image',
                    icon: '🖼️',
                    description: 'Single image with caption and styling options',
                    category: 'media',
                    template: {
                        type: 'image',
                        content: {
                            src: 'https://images.unsplash.com/photo-1542038784456-1ea8e8eba4f6?w=800&h=600&fit=crop',
                            alt: 'Professional photography sample',
                            caption: 'Professional portrait session',
                            alignment: 'center'
                        },
                        styles: {
                            width: '100%',
                            maxWidth: '800px',
                            borderRadius: '12px',
                            boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
                            margin: '30px auto'
                        }
                    }
                },
                {
                    id: 'gallery',
                    name: 'Gallery',
                    icon: '🖼️',
                    description: 'Grid layout for multiple images',
                    category: 'media',
                    template: {
                        type: 'gallery',
                        content: {
                            images: [
                                {
                                    src: 'https://images.unsplash.com/photo-1542038784456-1ea8e8eba4f6?w=400&h=300&fit=crop',
                                    alt: 'Portfolio image 1'
                                },
                                {
                                    src: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=400&h=300&fit=crop',
                                    alt: 'Portfolio image 2'
                                },
                                {
                                    src: 'https://images.unsplash.com/photo-1465145498025-928c7a71cab9?w=400&h=300&fit=crop',
                                    alt: 'Portfolio image 3'
                                },
                                {
                                    src: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=300&fit=crop',
                                    alt: 'Portfolio image 4'
                                }
                            ],
                            columns: 2,
                            spacing: 20,
                            title: 'Portfolio Gallery'
                        },
                        styles: {
                            gap: '20px',
                            margin: '40px 0'
                        }
                    }
                },
                {
                    id: 'video',
                    name: 'Video',
                    icon: '🎥',
                    description: 'Embedded video content',
                    category: 'media',
                    template: {
                        type: 'video',
                        content: {
                            src: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
                            title: 'Photography Showreel',
                            aspectRatio: '16:9'
                        },
                        styles: {
                            width: '100%',
                            maxWidth: '800px',
                            margin: '30px auto',
                            borderRadius: '12px',
                            overflow: 'hidden'
                        }
                    }
                }
            ],
            forms: [
                {
                    id: 'contact-form',
                    name: 'Contact Form',
                    icon: '📋',
                    description: 'Professional contact form with validation',
                    category: 'forms',
                    template: {
                        type: 'contact-form',
                        content: {
                            title: 'Get In Touch',
                            subtitle: 'Ready to capture your special moments? Let\'s discuss your photography needs.',
                            fields: [
                                { type: 'text', name: 'name', label: 'Full Name', required: true },
                                { type: 'email', name: 'email', label: 'Email Address', required: true },
                                { type: 'tel', name: 'phone', label: 'Phone Number', required: false },
                                { type: 'select', name: 'service', label: 'Service Type', options: ['Portrait Session', 'Wedding Photography', 'Event Photography', 'Commercial Work', 'Other'], required: true },
                                { type: 'textarea', name: 'message', label: 'Message', placeholder: 'Tell me about your photography needs...', required: true }
                            ],
                            submitText: 'Send Message',
                            successMessage: 'Thank you for your message! I\'ll get back to you within 24 hours.'
                        },
                        styles: {
                            maxWidth: '600px',
                            margin: '0 auto',
                            padding: '40px',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '12px'
                        }
                    }
                },
                {
                    id: 'newsletter',
                    name: 'Newsletter',
                    icon: '📧',
                    description: 'Email signup form for newsletters',
                    category: 'forms',
                    template: {
                        type: 'newsletter',
                        content: {
                            title: 'Stay Updated',
                            subtitle: 'Get photography tips and latest work updates',
                            placeholder: 'Enter your email address',
                            buttonText: 'Subscribe',
                            privacyText: 'We respect your privacy. Unsubscribe at any time.'
                        },
                        styles: {
                            textAlign: 'center',
                            padding: '50px 20px',
                            backgroundColor: 'var(--primary-color)',
                            color: 'white'
                        }
                    }
                },
                {
                    id: 'booking',
                    name: 'Booking Form',
                    icon: '📅',
                    description: 'Session booking form with date selection',
                    category: 'forms',
                    template: {
                        type: 'booking',
                        content: {
                            title: 'Book a Session',
                            subtitle: 'Schedule your photography session',
                            fields: [
                                { type: 'text', name: 'name', label: 'Full Name', required: true },
                                { type: 'email', name: 'email', label: 'Email', required: true },
                                { type: 'tel', name: 'phone', label: 'Phone', required: true },
                                { type: 'select', name: 'sessionType', label: 'Session Type', options: ['Portrait', 'Family', 'Couples', 'Headshots', 'Event'], required: true },
                                { type: 'date', name: 'preferredDate', label: 'Preferred Date', required: true },
                                { type: 'select', name: 'timeSlot', label: 'Time Preference', options: ['Morning (9AM-12PM)', 'Afternoon (1PM-5PM)', 'Evening (6PM-8PM)'], required: true },
                                { type: 'text', name: 'location', label: 'Preferred Location', required: false },
                                { type: 'textarea', name: 'details', label: 'Additional Details', required: false }
                            ],
                            submitText: 'Request Booking',
                            note: 'Booking requests will be confirmed within 24 hours'
                        },
                        styles: {
                            maxWidth: '700px',
                            margin: '0 auto'
                        }
                    }
                }
            ]
        };
    }
    
    getAllBlocks() {
        const allBlocks = [];
        Object.keys(this.blocks).forEach(category => {
            this.blocks[category].forEach(block => {
                allBlocks.push({
                    ...block,
                    category
                });
            });
        });
        return allBlocks;
    }
    
    getBlocksByCategory(category) {
        return this.blocks[category] || [];
    }
    
    getBlock(blockId) {
        const allBlocks = this.getAllBlocks();
        return allBlocks.find(block => block.id === blockId);
    }
    
    createBlockInstance(blockId) {
        const blockTemplate = this.getBlock(blockId);
        if (!blockTemplate) {
            console.error(`Block template not found: ${blockId}`);
            return null;
        }
        
        // Create a new instance with unique ID
        const instance = {
            ...JSON.parse(JSON.stringify(blockTemplate.template)),
            id: `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            blockType: blockId,
            createdAt: new Date().toISOString()
        };
        
        return instance;
    }
    
    renderBlock(block, themeId = 'minimal', brandColor = '#d4af37') {
        if (!block || !block.type) {
            return '<div class="block-error">Invalid block data</div>';
        }
        
        switch (block.type) {
            case 'hero':
                return this.renderHeroBlock(block, brandColor);
            case 'heading':
                return this.renderHeadingBlock(block, brandColor);
            case 'paragraph':
                return this.renderParagraphBlock(block);
            case 'image':
                return this.renderImageBlock(block);
            case 'gallery':
                return this.renderGalleryBlock(block);
            case 'quote':
                return this.renderQuoteBlock(block, brandColor);
            case 'list':
                return this.renderListBlock(block, brandColor);
            case 'two-column':
                return this.renderTwoColumnBlock(block);
            case 'three-column':
                return this.renderThreeColumnBlock(block, brandColor);
            case 'contact-form':
                return this.renderContactFormBlock(block, brandColor);
            case 'newsletter':
                return this.renderNewsletterBlock(block, brandColor);
            case 'booking':
                return this.renderBookingFormBlock(block, brandColor);
            case 'video':
                return this.renderVideoBlock(block);
            default:
                return `<div class="block-error">Unknown block type: ${block.type}</div>`;
        }
    }
    
    renderHeroBlock(block, brandColor) {
        const { title, subtitle, backgroundImage, buttonText, buttonLink, overlayOpacity } = block.content;
        return `
            <section class="hero section" style="background-image: url('${backgroundImage}'); ${block.styles ? this.stylesToCSS(block.styles) : ''}">
                <div class="hero-overlay" style="background: rgba(0,0,0,${overlayOpacity || 0.4});"></div>
                <div class="container">
                    <div class="hero-content">
                        <h1>${title}</h1>
                        <p>${subtitle}</p>
                        ${buttonText ? `<a href="${buttonLink || '#'}" class="btn">${buttonText}</a>` : ''}
                    </div>
                </div>
            </section>
        `;
    }
    
    renderHeadingBlock(block, brandColor) {
        const { text, level, alignment } = block.content;
        const styles = block.styles ? this.stylesToCSS(block.styles) : '';
        return `
            <div class="block heading-block" style="text-align: ${alignment || 'left'};">
                <${level || 'h2'} style="color: ${brandColor}; ${styles}">${text}</${level || 'h2'}>
            </div>
        `;
    }
    
    renderParagraphBlock(block) {
        const { text, alignment } = block.content;
        const styles = block.styles ? this.stylesToCSS(block.styles) : '';
        return `
            <div class="block paragraph-block" style="text-align: ${alignment || 'left'};">
                <p style="${styles}">${text}</p>
            </div>
        `;
    }
    
    renderImageBlock(block) {
        const { src, alt, caption, alignment } = block.content;
        const styles = block.styles ? this.stylesToCSS(block.styles) : '';
        return `
            <div class="block image-block" style="text-align: ${alignment || 'center'};">
                <img src="${src}" alt="${alt}" style="${styles}">
                ${caption ? `<p class="image-caption" style="font-style: italic; margin-top: 15px; color: #666;">${caption}</p>` : ''}
            </div>
        `;
    }
    
    renderGalleryBlock(block) {
        const { images, columns, spacing, title } = block.content;
        const styles = block.styles ? this.stylesToCSS(block.styles) : '';
        
        const imagesHTML = images.map(img => `
            <img src="${img.src || img}" alt="${img.alt || 'Gallery image'}" 
                 style="width: 100%; height: 250px; object-fit: cover; border-radius: 8px;">
        `).join('');
        
        return `
            <div class="block gallery-block">
                ${title ? `<h3 style="text-align: center; margin-bottom: 30px;">${title}</h3>` : ''}
                <div class="gallery gallery-${columns}" style="grid-template-columns: repeat(${columns}, 1fr); gap: ${spacing || 20}px; ${styles}">
                    ${imagesHTML}
                </div>
            </div>
        `;
    }
    
    renderQuoteBlock(block, brandColor) {
        const { text, author, position } = block.content;
        const styles = block.styles ? this.stylesToCSS(block.styles) : '';
        return `
            <div class="block quote-block">
                <blockquote style="border-left-color: ${brandColor}; ${styles}">
                    <p>"${text}"</p>
                    ${author ? `<footer style="margin-top: 20px; font-weight: 600;">
                        ${author}${position ? `, <em>${position}</em>` : ''}
                    </footer>` : ''}
                </blockquote>
            </div>
        `;
    }
    
    renderListBlock(block, brandColor) {
        const { items, listType, title } = block.content;
        const styles = block.styles ? this.stylesToCSS(block.styles) : '';
        const listTag = listType === 'numbered' ? 'ol' : 'ul';
        
        const itemsHTML = items.map(item => `<li>${item}</li>`).join('');
        
        return `
            <div class="block list-block" style="${styles}">
                ${title ? `<h3 style="color: ${brandColor}; margin-bottom: 20px;">${title}</h3>` : ''}
                <${listTag} style="padding-left: 30px;">
                    ${itemsHTML}
                </${listTag}>
            </div>
        `;
    }
    
    renderTwoColumnBlock(block) {
        const { leftColumn, rightColumn } = block.content;
        const styles = block.styles ? this.stylesToCSS(block.styles) : '';
        
        return `
            <div class="block two-column-block">
                <div style="display: grid; grid-template-columns: 1fr 1fr; ${styles}">
                    <div class="column">
                        ${this.renderColumnContent(leftColumn)}
                    </div>
                    <div class="column">
                        ${this.renderColumnContent(rightColumn)}
                    </div>
                </div>
            </div>
        `;
    }
    
    renderThreeColumnBlock(block, brandColor) {
        const { columns } = block.content;
        const styles = block.styles ? this.stylesToCSS(block.styles) : '';
        
        const columnsHTML = columns.map(col => `
            <div class="column" style="text-align: center; padding: 30px 20px;">
                <div style="font-size: 3rem; margin-bottom: 20px;">${col.icon}</div>
                <h3 style="color: ${brandColor}; margin-bottom: 15px;">${col.title}</h3>
                <p>${col.description}</p>
            </div>
        `).join('');
        
        return `
            <div class="block three-column-block">
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); ${styles}">
                    ${columnsHTML}
                </div>
            </div>
        `;
    }
    
    renderContactFormBlock(block, brandColor) {
        const { title, subtitle, fields, submitText } = block.content;
        const styles = block.styles ? this.stylesToCSS(block.styles) : '';
        
        const fieldsHTML = fields.map(field => {
            switch (field.type) {
                case 'textarea':
                    return `
                        <div class="form-group">
                            <label>${field.label}${field.required ? ' *' : ''}</label>
                            <textarea name="${field.name}" placeholder="${field.placeholder || ''}" 
                                     ${field.required ? 'required' : ''} rows="5"></textarea>
                        </div>
                    `;
                case 'select':
                    const options = field.options.map(opt => `<option value="${opt}">${opt}</option>`).join('');
                    return `
                        <div class="form-group">
                            <label>${field.label}${field.required ? ' *' : ''}</label>
                            <select name="${field.name}" ${field.required ? 'required' : ''}>
                                <option value="">Select ${field.label}</option>
                                ${options}
                            </select>
                        </div>
                    `;
                default:
                    return `
                        <div class="form-group">
                            <label>${field.label}${field.required ? ' *' : ''}</label>
                            <input type="${field.type}" name="${field.name}" 
                                   placeholder="${field.placeholder || ''}" 
                                   ${field.required ? 'required' : ''}>
                        </div>
                    `;
            }
        }).join('');
        
        return `
            <div class="block contact-form-block">
                <div class="contact-form" style="${styles}">
                    <h3 style="color: ${brandColor}; text-align: center; margin-bottom: 10px;">${title}</h3>
                    ${subtitle ? `<p style="text-align: center; margin-bottom: 30px; color: #666;">${subtitle}</p>` : ''}
                    <form action="#" method="post">
                        ${fieldsHTML}
                        <button type="submit" class="btn" style="background-color: ${brandColor}; width: 100%;">
                            ${submitText}
                        </button>
                    </form>
                </div>
            </div>
        `;
    }
    
    renderNewsletterBlock(block, brandColor) {
        const { title, subtitle, placeholder, buttonText, privacyText } = block.content;
        const styles = block.styles ? this.stylesToCSS(block.styles) : '';
        
        return `
            <div class="block newsletter-block">
                <div class="newsletter-signup" style="background-color: ${brandColor}; ${styles}">
                    <div class="container">
                        <h3 style="margin-bottom: 10px;">${title}</h3>
                        <p style="margin-bottom: 30px; opacity: 0.9;">${subtitle}</p>
                        <form style="display: flex; gap: 15px; max-width: 500px; margin: 0 auto;">
                            <input type="email" placeholder="${placeholder}" 
                                   style="flex: 1; padding: 12px; border: none; border-radius: 6px;">
                            <button type="submit" class="btn" 
                                    style="background: white; color: ${brandColor}; border: none;">
                                ${buttonText}
                            </button>
                        </form>
                        <p style="font-size: 0.9rem; margin-top: 15px; opacity: 0.8;">${privacyText}</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderBookingFormBlock(block, brandColor) {
        const { title, subtitle, fields, submitText, note } = block.content;
        const styles = block.styles ? this.stylesToCSS(block.styles) : '';
        
        const fieldsHTML = fields.map(field => {
            switch (field.type) {
                case 'textarea':
                    return `
                        <div class="form-group">
                            <label>${field.label}${field.required ? ' *' : ''}</label>
                            <textarea name="${field.name}" ${field.required ? 'required' : ''} 
                                     rows="4" placeholder="${field.placeholder || ''}"></textarea>
                        </div>
                    `;
                case 'select':
                    const options = field.options.map(opt => `<option value="${opt}">${opt}</option>`).join('');
                    return `
                        <div class="form-group">
                            <label>${field.label}${field.required ? ' *' : ''}</label>
                            <select name="${field.name}" ${field.required ? 'required' : ''}>
                                <option value="">Select ${field.label}</option>
                                ${options}
                            </select>
                        </div>
                    `;
                default:
                    return `
                        <div class="form-group">
                            <label>${field.label}${field.required ? ' *' : ''}</label>
                            <input type="${field.type}" name="${field.name}" 
                                   ${field.required ? 'required' : ''}>
                        </div>
                    `;
            }
        }).join('');
        
        return `
            <div class="block booking-form-block">
                <div class="booking-form" style="${styles}">
                    <h3 style="color: ${brandColor}; text-align: center; margin-bottom: 10px;">${title}</h3>
                    ${subtitle ? `<p style="text-align: center; margin-bottom: 30px; color: #666;">${subtitle}</p>` : ''}
                    <form action="#" method="post">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
                            ${fieldsHTML}
                        </div>
                        <button type="submit" class="btn" style="background-color: ${brandColor}; width: 100%; margin-top: 20px;">
                            ${submitText}
                        </button>
                        ${note ? `<p style="text-align: center; font-size: 0.9rem; color: #666; margin-top: 15px;">${note}</p>` : ''}
                    </form>
                </div>
            </div>
        `;
    }
    
    renderVideoBlock(block) {
        const { src, title, aspectRatio } = block.content;
        const styles = block.styles ? this.stylesToCSS(block.styles) : '';
        
        return `
            <div class="block video-block">
                ${title ? `<h3 style="text-align: center; margin-bottom: 20px;">${title}</h3>` : ''}
                <div class="video-container" style="position: relative; width: 100%; aspect-ratio: ${aspectRatio || '16/9'}; ${styles}">
                    <iframe src="${src}" 
                            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;"
                            allowfullscreen>
                    </iframe>
                </div>
            </div>
        `;
    }
    
    renderColumnContent(column) {
        if (!column) return '';
        
        switch (column.type) {
            case 'content':
                return column.content;
            case 'image':
                return `<img src="${column.src}" alt="${column.alt}" style="width: 100%; border-radius: 8px;">`;
            default:
                return column.content || '';
        }
    }
    
    stylesToCSS(styles) {
        return Object.entries(styles)
            .map(([key, value]) => {
                // Convert camelCase to kebab-case
                const cssKey = key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
                return `${cssKey}: ${value}`;
            })
            .join('; ');
    }
}

// Create global instance
const blockLibrary = new BlockLibrary();