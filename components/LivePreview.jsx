const LivePreview = ({ 
    blocks, 
    selectedBlock, 
    onSelectBlock, 
    onUpdateBlock, 
    onDeleteBlock, 
    onMoveBlock,
    theme,
    brandColor,
    activePage
}) => {
    const renderBlock = (block) => {
        const isSelected = selectedBlock === block.id;
        const blockStyles = {
            ...block.styles,
            position: 'relative',
            outline: isSelected ? `2px solid ${brandColor}` : 'none',
            cursor: 'pointer',
            animation: block.animations?.type ? `${block.animations.type} 1s ease ${block.animations.delay || '0s'}` : undefined
        };

        const controlsStyle = {
            position: 'absolute',
            top: '-30px',
            right: '0',
            display: isSelected ? 'flex' : 'none',
            gap: '5px',
            background: 'rgba(0,0,0,0.8)',
            padding: '4px',
            borderRadius: '4px',
            zIndex: 10
        };

        const buttonStyle = {
            background: 'none',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            padding: '2px 4px',
            fontSize: '12px'
        };

        let element;
        
        switch (block.type) {
            case 'heading':
                element = React.createElement(
                    'h1',
                    {
                        style: blockStyles,
                        onClick: () => onSelectBlock(block.id),
                        onDoubleClick: () => {
                            const newContent = prompt('Edit heading:', block.content);
                            if (newContent !== null) {
                                onUpdateBlock(block.id, { content: newContent });
                            }
                        }
                    },
                    block.content
                );
                break;

            case 'paragraph':
                element = React.createElement(
                    'p',
                    {
                        style: blockStyles,
                        onClick: () => onSelectBlock(block.id),
                        onDoubleClick: () => {
                            const newContent = prompt('Edit paragraph:', block.content);
                            if (newContent !== null) {
                                onUpdateBlock(block.id, { content: newContent });
                            }
                        }
                    },
                    block.content
                );
                break;

            case 'image':
                element = React.createElement(
                    'div',
                    {
                        style: { ...blockStyles, display: 'inline-block' },
                        onClick: () => onSelectBlock(block.id)
                    },
                    React.createElement('img', {
                        src: block.content,
                        alt: 'Website image',
                        style: {
                            ...block.styles,
                            maxWidth: '100%',
                            height: 'auto',
                            display: 'block'
                        },
                        onDoubleClick: () => {
                            const newSrc = prompt('Enter image URL:', block.content);
                            if (newSrc !== null) {
                                onUpdateBlock(block.id, { content: newSrc });
                            }
                        }
                    })
                );
                break;

            case 'button':
                element = React.createElement(
                    'button',
                    {
                        style: {
                            ...blockStyles,
                            backgroundColor: block.styles.backgroundColor || brandColor,
                            color: block.styles.color || 'white',
                            border: 'none',
                            padding: block.styles.padding || '10px 20px',
                            borderRadius: block.styles.borderRadius || '5px',
                            cursor: 'pointer',
                            fontSize: block.styles.fontSize || '16px'
                        },
                        onClick: () => onSelectBlock(block.id),
                        onDoubleClick: () => {
                            const newContent = prompt('Edit button text:', block.content);
                            if (newContent !== null) {
                                onUpdateBlock(block.id, { content: newContent });
                            }
                        }
                    },
                    block.content
                );
                break;

            default:
                element = React.createElement(
                    'div',
                    {
                        style: blockStyles,
                        onClick: () => onSelectBlock(block.id)
                    },
                    block.content
                );
        }

        return React.createElement(
            'div',
            {
                key: block.id,
                className: 'canvas-block',
                style: { position: 'relative', margin: '10px 0' }
            },
            element,
            // Block controls
            React.createElement(
                'div',
                { style: controlsStyle },
                React.createElement(
                    'button',
                    {
                        style: buttonStyle,
                        onClick: () => onMoveBlock(block.id, 'up'),
                        title: 'Move up'
                    },
                    '↑'
                ),
                React.createElement(
                    'button',
                    {
                        style: buttonStyle,
                        onClick: () => onMoveBlock(block.id, 'down'),
                        title: 'Move down'
                    },
                    '↓'
                ),
                React.createElement(
                    'button',
                    {
                        style: buttonStyle,
                        onClick: () => {
                            if (confirm('Delete this block?')) {
                                onDeleteBlock(block.id);
                            }
                        },
                        title: 'Delete'
                    },
                    '×'
                )
            )
        );
    };

    const getThemeStyles = () => {
        const themes = {
            'classic': {
                background: 'linear-gradient(135deg, #f8f9fa, #e9ecef)',
                color: '#343a40'
            },
            'modern': {
                background: 'linear-gradient(135deg, #2563EB, #1e40af)',  
                color: '#f8f9fa'
            },
            'dark': {
                background: 'linear-gradient(135deg, #1f2937, #111827)',
                color: '#f9fafb'
            },
            'bold': {
                background: 'linear-gradient(135deg, #dc2626, #991b1b)',
                color: '#fef2f2'
            }
        };
        return themes[theme] || themes['classic'];
    };

    const themeStyles = getThemeStyles();

    return React.createElement(
        'div',
        { className: 'canvas' },
        React.createElement('h3', null, '🎨 Live Preview'),
        React.createElement(
            'div',
            {
                className: 'preview-container',
                style: {
                    background: themeStyles.background,
                    color: themeStyles.color,
                    padding: '40px',
                    borderRadius: '12px',
                    minHeight: '400px',
                    border: '2px solid #e5e7eb',
                    position: 'relative'
                }
            },
            blocks.length === 0 ? 
                React.createElement(
                    'div',
                    {
                        style: {
                            textAlign: 'center',
                            color: '#666',
                            padding: '60px 20px',
                            fontSize: '16px'
                        }
                    },
                    React.createElement('p', null, '👈 Click on blocks in the sidebar to start building'),
                    React.createElement('p', { style: { marginTop: '10px', fontSize: '14px' } }, 'Double-click any block to edit its content')
                ) :
                blocks.map(renderBlock)
        ),
        
        // Preview Tips and Stats
        React.createElement(
            'div',
            {
                style: {
                    marginTop: '15px',
                    padding: '12px',
                    background: '#f3f4f6',
                    borderRadius: '6px',
                    fontSize: '14px',
                    color: '#4b5563'
                }
            },
            React.createElement('strong', null, '💡 Tips: '),
            'Click to select • Double-click to edit • Use controls to move/delete',
            React.createElement('br'),
            React.createElement('small', { style: { marginTop: '8px', display: 'block', color: '#6b7280' } }, `📊 ${blocks.length} blocks • Theme: ${theme} • Ready to publish!`)
        )
    );
};

window.LivePreview = LivePreview;