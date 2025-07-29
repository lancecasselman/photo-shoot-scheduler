// TemplateSelector.jsx - Template selection component

const TemplateSelector = ({ onApplyTemplate, currentTheme }) => {
    const [selectedCategory, setSelectedCategory] = React.useState('All');
    const [showTemplates, setShowTemplates] = React.useState(false);
    
    const templates = window.PresetTemplates || {};
    const categories = window.TemplateCategories || ['All'];
    
    // Enhanced debug logging and validation
    React.useEffect(() => {
        console.log('TemplateSelector: Templates available:', Object.keys(templates).length);
        console.log('TemplateSelector: Categories available:', categories.length);
        
        if (Object.keys(templates).length === 0) {
            console.error('TemplateSelector: No templates loaded!');
        } else {
            console.log('TemplateSelector: First template:', Object.keys(templates)[0]);
            
            // Validate templates structure
            const templateKeys = Object.keys(templates);
            let validTemplates = 0;
            let invalidTemplates = 0;
            
            templateKeys.forEach(key => {
                const template = templates[key];
                if (template && template.name && template.pages && Object.keys(template.pages).length > 0) {
                    validTemplates++;
                } else {
                    invalidTemplates++;
                    console.warn(`TemplateSelector: Invalid template structure for ${key}:`, template);
                }
            });
            
            console.log(`TemplateSelector: Validation complete - ${validTemplates} valid, ${invalidTemplates} invalid templates`);
        }
    }, [templates, categories]);
    
    const filteredTemplates = Object.entries(templates).filter(([key, template]) => {
        if (!template || !template.pages) {
            console.warn(`Template ${key} is missing pages structure`);
            return false;
        }
        if (selectedCategory === 'All') return true;
        return template.category === selectedCategory;
    });
    
    // Check if templates are loaded
    const templatesLoaded = Object.keys(templates).length > 0;
    const validTemplates = filteredTemplates.filter(([key, template]) => 
        template && template.name && template.pages && Object.keys(template.pages).length > 0
    );

    return React.createElement(
        'div',
        { className: 'template-selector' },
        
        React.createElement(
            'button',
            {
                className: 'toggle-templates-btn',
                onClick: () => setShowTemplates(!showTemplates),
                disabled: !templatesLoaded
            },
            !templatesLoaded ? '⏳ Loading Templates...' :
            showTemplates ? '🎨 Hide Templates' : `🎨 Choose Template (${validTemplates.length} available)`
        ),
        
        showTemplates && React.createElement(
            'div',
            { className: 'templates-panel' },
            
            // Category Filter
            React.createElement(
                'div',
                { className: 'category-filter' },
                React.createElement('h4', null, 'Filter by Category:'),
                React.createElement(
                    'div',
                    { className: 'category-buttons' },
                    ...categories.map(category =>
                        React.createElement(
                            'button',
                            {
                                key: category,
                                className: `category-btn ${selectedCategory === category ? 'active' : ''}`,
                                onClick: () => setSelectedCategory(category)
                            },
                            category
                        )
                    )
                )
            ),
            
            // Template Status
            !templatesLoaded && React.createElement(
                'div',
                { className: 'loading-status' },
                React.createElement('p', null, '⏳ Loading templates...'),
                React.createElement('small', null, 'Please wait while templates are being loaded and validated.')
            ),
            
            // Template Grid
            templatesLoaded && React.createElement(
                'div',
                { className: 'templates-grid' },
                validTemplates.length === 0 ? 
                    React.createElement(
                        'div',
                        { className: 'no-templates' },
                        React.createElement('p', null, '❌ No valid templates found'),
                        React.createElement('small', null, `Total templates: ${Object.keys(templates).length}, Valid: ${validTemplates.length}`)
                    ) :
                    ...validTemplates.map(([key, template]) => {
                        const pageCount = Object.keys(template.pages || {}).length;
                        const blockCount = Object.values(template.pages || {}).reduce((total, blocks) => 
                            total + (Array.isArray(blocks) ? blocks.length : 0), 0
                        );
                        
                        return React.createElement(
                            'div',
                            {
                                key: key,
                                className: 'template-card'
                            },
                            React.createElement('h5', null, template.name || 'Unnamed Template'),
                            React.createElement('p', null, template.description || 'No description available'),
                            React.createElement('small', null, `Category: ${template.category || 'Uncategorized'}`),
                            React.createElement('small', { style: { display: 'block', marginTop: '5px', color: '#666' } }, 
                                `📄 ${pageCount} pages • 🧱 ${blockCount} blocks`
                            ),
                            React.createElement(
                                'button',
                                {
                                    className: 'apply-template-btn',
                                    onClick: () => {
                                        console.log(`Applying template: ${key}`, template);
                                        onApplyTemplate(key);
                                        setShowTemplates(false);
                                    }
                                },
                                'Apply Template'
                            )
                        );
                    })
            ),
            
            // Close Templates Panel
            React.createElement(
                'button',
                {
                    className: 'close-templates-btn',
                    onClick: () => setShowTemplates(false)
                },
                'Close Templates'
            )
        )
    );
};

// Make component globally available
window.TemplateSelector = TemplateSelector;