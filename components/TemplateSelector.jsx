// TemplateSelector.jsx - Template selection component

const TemplateSelector = ({ onApplyTemplate, currentTheme }) => {
    const [selectedCategory, setSelectedCategory] = React.useState('All');
    const [showTemplates, setShowTemplates] = React.useState(false);
    
    const templates = window.PresetTemplates || {};
    const categories = window.TemplateCategories || ['All'];
    
    // Debug logging
    React.useEffect(() => {
        console.log('TemplateSelector: Templates available:', Object.keys(templates).length);
        console.log('TemplateSelector: Categories available:', categories.length);
        console.log('TemplateSelector: First template:', Object.keys(templates)[0]);
    }, [templates, categories]);
    
    const filteredTemplates = Object.entries(templates).filter(([key, template]) => {
        if (!template || !template.pages) {
            console.warn(`Template ${key} is missing pages structure`);
            return false;
        }
        if (selectedCategory === 'All') return true;
        return template.category === selectedCategory;
    });
    
    return React.createElement(
        'div',
        { className: 'template-selector' },
        
        React.createElement(
            'button',
            {
                className: 'toggle-templates-btn',
                onClick: () => setShowTemplates(!showTemplates)
            },
            showTemplates ? '🎨 Hide Templates' : '🎨 Choose Template'
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
            
            // Template Grid
            React.createElement(
                'div',
                { className: 'templates-grid' },
                ...filteredTemplates.map(([key, template]) =>
                    React.createElement(
                        'div',
                        {
                            key: key,
                            className: 'template-card'
                        },
                        React.createElement('h5', null, template.name),
                        React.createElement('p', null, template.description),
                        React.createElement('small', null, `Category: ${template.category}`),
                        React.createElement(
                            'button',
                            {
                                className: 'apply-template-btn',
                                onClick: () => {
                                    onApplyTemplate(key);
                                    setShowTemplates(false);
                                }
                            },
                            'Apply Template'
                        )
                    )
                )
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