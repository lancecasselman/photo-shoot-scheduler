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
                        // Add homepage template with celebration
                        setTimeout(() => onAddBlock('heading'), 0);
                        setTimeout(() => onAddBlock('paragraph'), 200);
                        setTimeout(() => onAddBlock('image'), 400);
                        setTimeout(() => onAddBlock('button'), 600);
                        
                        if (window.showCelebration) {
                            setTimeout(() => {
                                window.showCelebration('🏠 Homepage Template Added!', 35);
                            }, 800);
                        }
                    }
                },
                '🏠 Homepage Layout'
            ),
            React.createElement(
                'button',
                {
                    className: 'template-btn',
                    onClick: () => {
                        // Add about page template
                        setTimeout(() => onAddBlock('heading'), 0);
                        setTimeout(() => onAddBlock('paragraph'), 200);
                        setTimeout(() => onAddBlock('paragraph'), 400);
                        
                        if (window.showCelebration) {
                            setTimeout(() => {
                                window.showCelebration('📖 About Template Added!', 30);
                            }, 600);
                        }
                    }
                },
                '📖 About Page'
            ),
            React.createElement(
                'button',
                {
                    className: 'template-btn',
                    onClick: () => {
                        // Add gallery template
                        setTimeout(() => onAddBlock('heading'), 0);
                        setTimeout(() => onAddBlock('image'), 200);
                        setTimeout(() => onAddBlock('image'), 400);
                        setTimeout(() => onAddBlock('image'), 600);
                        
                        if (window.showCelebration) {
                            setTimeout(() => {
                                window.showCelebration('🖼️ Gallery Template Added!', 40);
                            }, 800);
                        }
                    }
                },
                '🖼️ Gallery Grid'
            )
        )
    );
};

window.BlockLibrary = BlockLibrary;