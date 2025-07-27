const BlockEditor = ({ block, onUpdateBlock, brandColor }) => {
    if (!block) return null;

    const updateStyles = (newStyles) => {
        onUpdateBlock(block.id, {
            styles: { ...block.styles, ...newStyles }
        });
    };

    const updateContent = (newContent) => {
        onUpdateBlock(block.id, { content: newContent });
    };

    return React.createElement(
        'div',
        { className: 'block-editor' },
        React.createElement('h4', null, `Edit ${block.type.charAt(0).toUpperCase() + block.type.slice(1)}`),
        
        // Content Editor
        React.createElement(
            'div',
            { className: 'property-group' },
            React.createElement('label', null, 'Content'),
            block.type === 'paragraph' ?
                React.createElement('textarea', {
                    value: block.content,
                    onChange: (e) => updateContent(e.target.value),
                    rows: 3,
                    style: { width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }
                }) :
                React.createElement('input', {
                    type: block.type === 'image' ? 'url' : 'text',
                    value: block.content,
                    onChange: (e) => updateContent(e.target.value),
                    placeholder: block.type === 'image' ? 'Enter image URL' : 'Enter text'
                })
        ),

        // Font Size
        React.createElement(
            'div',
            { className: 'property-group' },
            React.createElement('label', null, 'Font Size'),
            React.createElement('input', {
                type: 'range',
                min: '12',
                max: '72',
                value: parseInt(block.styles.fontSize) || 16,
                onChange: (e) => updateStyles({ fontSize: `${e.target.value}px` })
            }),
            React.createElement('span', null, block.styles.fontSize || '16px')
        ),

        // Text Color
        block.type !== 'image' && React.createElement(
            'div',
            { className: 'property-group' },
            React.createElement('label', null, 'Text Color'),
            React.createElement('input', {
                type: 'color',
                value: block.styles.color || '#333333',
                onChange: (e) => updateStyles({ color: e.target.value })
            })
        ),

        // Background Color (for buttons)
        block.type === 'button' && React.createElement(
            'div',
            { className: 'property-group' },
            React.createElement('label', null, 'Background Color'),
            React.createElement('input', {
                type: 'color',
                value: block.styles.backgroundColor || brandColor,
                onChange: (e) => updateStyles({ backgroundColor: e.target.value })
            })
        ),

        // Text Alignment
        block.type !== 'image' && React.createElement(
            'div',
            { className: 'property-group' },
            React.createElement('label', null, 'Text Alignment'),
            React.createElement(
                'select',
                {
                    value: block.styles.textAlign || 'left',
                    onChange: (e) => updateStyles({ textAlign: e.target.value })
                },
                React.createElement('option', { value: 'left' }, 'Left'),
                React.createElement('option', { value: 'center' }, 'Center'),
                React.createElement('option', { value: 'right' }, 'Right'),
                React.createElement('option', { value: 'justify' }, 'Justify')
            )
        ),

        // Font Weight (for headings and buttons)
        (block.type === 'heading' || block.type === 'button') && React.createElement(
            'div',
            { className: 'property-group' },
            React.createElement('label', null, 'Font Weight'),
            React.createElement(
                'select',
                {
                    value: block.styles.fontWeight || 'normal',
                    onChange: (e) => updateStyles({ fontWeight: e.target.value })
                },
                React.createElement('option', { value: 'normal' }, 'Normal'),
                React.createElement('option', { value: 'bold' }, 'Bold'),
                React.createElement('option', { value: '600' }, 'Semi-Bold'),
                React.createElement('option', { value: '300' }, 'Light')
            )
        ),

        // Padding (for buttons)
        block.type === 'button' && React.createElement(
            'div',
            { className: 'property-group' },
            React.createElement('label', null, 'Padding'),
            React.createElement('input', {
                type: 'text',
                value: block.styles.padding || '10px 20px',
                onChange: (e) => updateStyles({ padding: e.target.value }),
                placeholder: '10px 20px'
            })
        ),

        // Border Radius (for buttons and images)
        (block.type === 'button' || block.type === 'image') && React.createElement(
            'div',
            { className: 'property-group' },
            React.createElement('label', null, 'Border Radius'),
            React.createElement('input', {
                type: 'range',
                min: '0',
                max: '50',
                value: parseInt(block.styles.borderRadius) || 0,
                onChange: (e) => updateStyles({ borderRadius: `${e.target.value}px` })
            }),
            React.createElement('span', null, block.styles.borderRadius || '0px')
        ),

        // Width (for images)
        block.type === 'image' && React.createElement(
            'div',
            { className: 'property-group' },
            React.createElement('label', null, 'Width'),
            React.createElement(
                'select',
                {
                    value: block.styles.width || '100%',
                    onChange: (e) => updateStyles({ width: e.target.value })
                },
                React.createElement('option', { value: '100%' }, 'Full Width'),
                React.createElement('option', { value: '75%' }, '75%'),
                React.createElement('option', { value: '50%' }, '50%'),
                React.createElement('option', { value: '25%' }, '25%'),
                React.createElement('option', { value: '300px' }, '300px'),
                React.createElement('option', { value: '400px' }, '400px'),
                React.createElement('option', { value: '500px' }, '500px')
            )
        ),

        // Margin
        React.createElement(
            'div',
            { className: 'property-group' },
            React.createElement('label', null, 'Margin'),
            React.createElement('input', {
                type: 'text',
                value: block.styles.margin || '20px 0',
                onChange: (e) => updateStyles({ margin: e.target.value }),
                placeholder: '20px 0'
            })
        ),

        // Quick Style Presets
        React.createElement(
            'div',
            { className: 'property-group' },
            React.createElement('label', null, 'Quick Styles'),
            React.createElement(
                'div',
                { style: { display: 'flex', gap: '5px', flexWrap: 'wrap' } },
                
                // Heading presets
                block.type === 'heading' && [
                    React.createElement(
                        'button',
                        {
                            key: 'hero',
                            className: 'preset-btn',
                            onClick: () => updateStyles({
                                fontSize: '48px',
                                fontWeight: 'bold',
                                textAlign: 'center',
                                color: brandColor
                            })
                        },
                        'Hero'
                    ),
                    React.createElement(
                        'button',
                        {
                            key: 'section',
                            className: 'preset-btn',
                            onClick: () => updateStyles({
                                fontSize: '32px',
                                fontWeight: '600',
                                textAlign: 'left',
                                color: '#333'
                            })
                        },
                        'Section'
                    )
                ],

                // Button presets
                block.type === 'button' && [
                    React.createElement(
                        'button',
                        {
                            key: 'primary',
                            className: 'preset-btn',
                            onClick: () => updateStyles({
                                backgroundColor: brandColor,
                                color: 'white',
                                padding: '12px 24px',
                                borderRadius: '6px',
                                fontWeight: '600'
                            })
                        },
                        'Primary'
                    ),
                    React.createElement(
                        'button',
                        {
                            key: 'outline',
                            className: 'preset-btn',
                            onClick: () => updateStyles({
                                backgroundColor: 'transparent',
                                color: brandColor,
                                padding: '12px 24px',
                                borderRadius: '6px',
                                border: `2px solid ${brandColor}`
                            })
                        },
                        'Outline'
                    )
                ]
            )
        )
    );
};

window.BlockEditor = BlockEditor;