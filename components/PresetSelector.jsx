// PresetSelector.jsx - Website Template Selection Component

function PresetSelector({ onApplyPreset, currentPreset }) {
    const [isOpen, setIsOpen] = React.useState(false);
    const [selectedCategory, setSelectedCategory] = React.useState('all');

    const presets = [
        { id: 'timeless', name: 'Timeless Wedding', preset: window.TimelessWeddingPreset, category: 'wedding' },
        { id: 'bold', name: 'Bold Minimalist', preset: window.BoldMinimalistPreset, category: 'minimalist' },
        { id: 'beach', name: 'Beach Vibes', preset: window.BeachVibesPreset, category: 'coastal' },
        { id: 'moody', name: 'Moody Editorial', preset: window.MoodyEditorialPreset, category: 'editorial' },
        { id: 'light', name: 'Light & Airy', preset: window.LightAndAiryPreset, category: 'lifestyle' },
        { id: 'vintage', name: 'Vintage Fashion', preset: window.VintageFashionPreset, category: 'fashion' },
        { id: 'blackwhite', name: 'Black & White Classic', preset: window.BlackAndWhitePreset, category: 'classic' },
        { id: 'outdoor', name: 'Outdoor Adventure', preset: window.OutdoorAdventurePreset, category: 'adventure' }
    ];

    const categories = [
        { id: 'all', name: 'All Templates', icon: '🎨' },
        { id: 'wedding', name: 'Wedding', icon: '💍' },
        { id: 'minimalist', name: 'Minimalist', icon: '⚪' },
        { id: 'coastal', name: 'Coastal', icon: '🌊' },
        { id: 'editorial', name: 'Editorial', icon: '📸' },
        { id: 'lifestyle', name: 'Lifestyle', icon: '🌸' },
        { id: 'fashion', name: 'Fashion', icon: '👗' },
        { id: 'classic', name: 'Classic', icon: '⚫' },
        { id: 'adventure', name: 'Adventure', icon: '🏔️' }
    ];

    const filteredPresets = selectedCategory === 'all' 
        ? presets 
        : presets.filter(preset => preset.category === selectedCategory);

    const handlePresetSelect = (preset) => {
        if (onApplyPreset && preset.preset) {
            onApplyPreset(preset.preset);
            setIsOpen(false);
            
            // Show celebration animation
            if (window.showCelebration) {
                window.showCelebration(`🚀 ${preset.name} Template Applied!`, 50);
            }
        }
    };

    const getCurrentPresetName = () => {
        if (!currentPreset?.meta?.name) return 'Custom Website';
        return currentPreset.meta.name;
    };

    return React.createElement(
        'div',
        { className: 'preset-selector' },
        
        // Header
        React.createElement(
            'div',
            { className: 'preset-header' },
            React.createElement('h3', null, '🎯 Website Templates'),
            React.createElement('div', { className: 'preset-subtitle' }, 'Choose from professional designs')
        ),

        // Current Template Display
        React.createElement(
            'div',
            { className: 'current-template' },
            React.createElement('span', { className: 'template-label' }, 'Current: '),
            React.createElement('strong', null, getCurrentPresetName())
        ),

        // Template Selector Button
        React.createElement(
            'button',
            {
                onClick: () => setIsOpen(!isOpen),
                className: `template-button ${isOpen ? 'active' : ''}`
            },
            '🎨 Choose Template',
            React.createElement('span', { className: 'arrow' }, isOpen ? '▲' : '▼')
        ),

        // Template Selection Panel
        isOpen && React.createElement(
            'div',
            { className: 'template-panel' },
            
            // Category Filters
            React.createElement(
                'div',
                { className: 'category-filters' },
                categories.map(category =>
                    React.createElement(
                        'button',
                        {
                            key: category.id,
                            onClick: () => setSelectedCategory(category.id),
                            className: `category-btn ${selectedCategory === category.id ? 'active' : ''}`
                        },
                        category.icon,
                        ' ',
                        category.name
                    )
                )
            ),

            // Template Grid
            React.createElement(
                'div',
                { className: 'template-grid' },
                filteredPresets.map(preset =>
                    React.createElement(
                        'div',
                        {
                            key: preset.id,
                            onClick: () => handlePresetSelect(preset),
                            className: 'template-card',
                            title: `Apply ${preset.name} template`
                        },
                        React.createElement(
                            'div',
                            { 
                                className: 'template-preview',
                                style: { backgroundColor: preset.preset?.meta?.brandColor || '#D4AF37' }
                            },
                            React.createElement('div', { className: 'preview-icon' }, '🎨')
                        ),
                        React.createElement(
                            'div',
                            { className: 'template-info' },
                            React.createElement('h4', null, preset.name),
                            React.createElement('p', null, preset.preset?.meta?.description || 'Professional template'),
                            React.createElement(
                                'div',
                                { className: 'template-meta' },
                                React.createElement('span', { className: 'font-info' }, preset.preset?.meta?.font || 'Default Font')
                            )
                        )
                    )
                )
            ),

            // Close Button
            React.createElement(
                'button',
                {
                    onClick: () => setIsOpen(false),
                    className: 'close-panel-btn'
                },
                '✕ Close Templates'
            )
        ),

        // Styles
        React.createElement('style', { jsx: true }, `
            .preset-selector {
                background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 20px;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
            }

            .preset-header {
                text-align: center;
                margin-bottom: 15px;
            }

            .preset-header h3 {
                margin: 0 0 5px 0;
                color: #2d3748;
                font-size: 18px;
                font-weight: 600;
            }

            .preset-subtitle {
                color: #718096;
                font-size: 14px;
            }

            .current-template {
                background: rgba(212, 175, 55, 0.1);
                padding: 10px 15px;
                border-radius: 8px;
                margin: 15px 0;
                text-align: center;
                border: 1px solid rgba(212, 175, 55, 0.2);
            }

            .template-label {
                color: #666;
                font-size: 14px;
            }

            .template-button {
                width: 100%;
                background: linear-gradient(135deg, #D4AF37, #B8941F);
                color: white;
                border: none;
                padding: 15px 20px;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                align-items: center;
                transition: all 0.3s ease;
                margin-bottom: 15px;
            }

            .template-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 15px rgba(212, 175, 55, 0.3);
            }

            .template-button.active {
                background: linear-gradient(135deg, #B8941F, #9A7B1A);
            }

            .arrow {
                font-size: 12px;
                transition: transform 0.3s ease;
            }

            .template-panel {
                background: white;
                border-radius: 12px;
                padding: 20px;
                box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
                max-height: 500px;
                overflow-y: auto;
            }

            .category-filters {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 1px solid #e2e8f0;
            }

            .category-btn {
                background: #f7fafc;
                border: 1px solid #e2e8f0;
                padding: 8px 12px;
                border-radius: 20px;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .category-btn:hover {
                background: #edf2f7;
                border-color: #cbd5e0;
            }

            .category-btn.active {
                background: linear-gradient(135deg, #D4AF37, #B8941F);
                color: white;
                border-color: #D4AF37;
            }

            .template-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 15px;
            }

            .template-card {
                background: #f8fafc;
                border-radius: 12px;
                padding: 15px;
                cursor: pointer;
                transition: all 0.3s ease;
                border: 2px solid transparent;
            }

            .template-card:hover {
                transform: translateY(-3px);
                box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
                border-color: #D4AF37;
            }

            .template-preview {
                height: 80px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 12px;
                position: relative;
                overflow: hidden;
            }

            .preview-icon {
                font-size: 32px;
                opacity: 0.8;
            }

            .template-info h4 {
                margin: 0 0 8px 0;
                color: #2d3748;
                font-size: 16px;
                font-weight: 600;
            }

            .template-info p {
                margin: 0 0 10px 0;
                color: #718096;
                font-size: 13px;
                line-height: 1.4;
            }

            .template-meta {
                font-size: 11px;
                color: #a0aec0;
                font-style: italic;
            }

            .close-panel-btn {
                width: 100%;
                background: #e2e8f0;
                color: #4a5568;
                border: none;
                padding: 12px;
                border-radius: 8px;
                margin-top: 15px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s ease;
            }

            .close-panel-btn:hover {
                background: #cbd5e0;
            }

            @media (max-width: 768px) {
                .template-grid {
                    grid-template-columns: 1fr;
                }
                
                .category-filters {
                    justify-content: center;
                }
                
                .category-btn {
                    font-size: 11px;
                    padding: 6px 10px;
                }
            }
        `)
    );
}

window.PresetSelector = PresetSelector;