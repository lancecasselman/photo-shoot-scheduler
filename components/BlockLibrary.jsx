const BlockLibrary = ({ onAddBlock, brandColor }) => {
    const blockTypes = [
        {
            type: 'heading',
            icon: '📝',
            name: 'Heading',
            description: 'Add a title or heading'
        },
        {
            type: 'paragraph',
            icon: '📄',
            name: 'Paragraph',
            description: 'Add text content'
        },
        {
            type: 'image',
            icon: '🖼️',
            name: 'Image',
            description: 'Add a photo or image'
        },
        {
            type: 'button',
            icon: '🔘',
            name: 'Button',
            description: 'Add a call-to-action button'
        }
    ];

    return React.createElement(
        'div',
        { className: 'sidebar' },
        React.createElement('h3', null, '🧩 Add Blocks'),
        React.createElement(
            'div',
            { className: 'block-library' },
            blockTypes.map(blockType =>
                React.createElement(
                    'div',
                    {
                        key: blockType.type,
                        className: 'block-item',
                        onClick: () => onAddBlock(blockType.type),
                        style: { borderColor: 'transparent' }
                    },
                    React.createElement('span', { className: 'block-icon' }, blockType.icon),
                    React.createElement(
                        'div',
                        { className: 'block-info' },
                        React.createElement('strong', null, blockType.name),
                        React.createElement(
                            'div',
                            { className: 'block-description' },
                            blockType.description
                        )
                    )
                )
            )
        ),
        
        // Quick Templates
        React.createElement('h3', { style: { marginTop: '30px' } }, '⚡ Quick Start'),
        React.createElement(
            'div',
            { className: 'template-buttons' },
            React.createElement(
                'button',
                {
                    className: 'template-btn',
                    onClick: () => {
                        onAddBlock('heading');
                        onAddBlock('paragraph');
                        onAddBlock('image');
                        onAddBlock('button');
                    }
                },
                '🏠 Homepage Layout'
            ),
            React.createElement(
                'button',
                {
                    className: 'template-btn',
                    onClick: () => {
                        onAddBlock('heading');
                        onAddBlock('paragraph');
                        onAddBlock('paragraph');
                    }
                },
                '📖 About Page'
            ),
            React.createElement(
                'button',
                {
                    className: 'template-btn',
                    onClick: () => {
                        onAddBlock('heading');
                        onAddBlock('image');
                        onAddBlock('image');
                        onAddBlock('image');
                    }
                },
                '🖼️ Gallery Grid'
            )
        )
    );
};

window.BlockLibrary = BlockLibrary;