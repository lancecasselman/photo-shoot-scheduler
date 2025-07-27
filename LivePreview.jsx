// Live Preview Component - Real-time Website Editor
import React, { useState } from 'react';

const LivePreview = ({ 
    siteConfig, 
    selectedBlock, 
    onSelectBlock, 
    onUpdateBlock, 
    onDeleteBlock, 
    onMoveBlock,
    theme 
}) => {
    const [editingBlock, setEditingBlock] = useState(null);
    const [editContent, setEditContent] = useState('');

    // Start editing a block
    const startEditing = (block) => {
        setEditingBlock(block.id);
        setEditContent(block.content);
    };

    // Save block changes
    const saveBlock = () => {
        if (editingBlock) {
            onUpdateBlock(editingBlock, { content: editContent });
            setEditingBlock(null);
            setEditContent('');
        }
    };

    // Cancel editing
    const cancelEdit = () => {
        setEditingBlock(null);
        setEditContent('');
    };

    // Update block style
    const updateBlockStyle = (blockId, styleProperty, value) => {
        const block = siteConfig.blocks.find(b => b.id === blockId);
        if (block) {
            const newStyles = { ...block.styles, [styleProperty]: value };
            onUpdateBlock(blockId, { styles: newStyles });
        }
    };

    // Render block content
    const renderBlock = (block) => {
        const isSelected = selectedBlock === block.id;
        const isEditing = editingBlock === block.id;

        const blockElement = (() => {
            switch (block.type) {
                case 'heading':
                    return isEditing ? (
                        <input
                            type="text"
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            onBlur={saveBlock}
                            onKeyPress={(e) => e.key === 'Enter' && saveBlock()}
                            style={{
                                ...block.styles,
                                border: '2px dashed #D4AF37',
                                background: 'transparent',
                                outline: 'none'
                            }}
                            autoFocus
                        />
                    ) : (
                        <h1 
                            style={block.styles}
                            onDoubleClick={() => startEditing(block)}
                        >
                            {block.content}
                        </h1>
                    );

                case 'paragraph':
                    return isEditing ? (
                        <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            onBlur={saveBlock}
                            style={{
                                ...block.styles,
                                border: '2px dashed #D4AF37',
                                background: 'transparent',
                                outline: 'none',
                                minHeight: '100px',
                                resize: 'vertical'
                            }}
                            autoFocus
                        />
                    ) : (
                        <p 
                            style={block.styles}
                            onDoubleClick={() => startEditing(block)}
                        >
                            {block.content}
                        </p>
                    );

                case 'image':
                    return (
                        <div className="image-block">
                            <img 
                                src={block.content}
                                alt="Site content"
                                style={block.styles}
                                onError={(e) => {
                                    e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDUwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI1MDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yNTAgMTUwTDMwMCAxMDBIMjAwTDI1MCAxNTBaIiBmaWxsPSIjOUI5QkE0Ii8+CjxjaXJjbGUgY3g9IjE4MCIgY3k9IjEyMCIgcj0iMjAiIGZpbGw9IiM5QjlCQTQiLz4KPHRleHQgeD0iMjUwIiB5PSIyMDAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM5QjlCQTQiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNiI+SW1hZ2UgUGxhY2Vob2xkZXI8L3RleHQ+Cjwvc3ZnPgo=';
                                }}
                            />
                            {isSelected && (
                                <div className="image-controls">
                                    <input
                                        type="url"
                                        placeholder="Enter image URL"
                                        onBlur={(e) => onUpdateBlock(block.id, { content: e.target.value })}
                                        className="image-url-input"
                                    />
                                </div>
                            )}
                        </div>
                    );

                case 'button':
                    return isEditing ? (
                        <input
                            type="text"
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            onBlur={saveBlock}
                            onKeyPress={(e) => e.key === 'Enter' && saveBlock()}
                            style={{
                                ...block.styles,
                                border: '2px dashed #D4AF37'
                            }}
                            autoFocus
                        />
                    ) : (
                        <button 
                            style={block.styles}
                            onDoubleClick={() => startEditing(block)}
                            onClick={(e) => e.preventDefault()}
                        >
                            {block.content}
                        </button>
                    );

                default:
                    return <div>Unknown block type</div>;
            }
        })();

        return (
            <div
                key={block.id}
                className={`preview-block ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectBlock(block.id)}
            >
                {blockElement}
                
                {isSelected && (
                    <div className="block-controls">
                        <div className="block-actions">
                            <button 
                                onClick={() => onMoveBlock(block.id, 'up')}
                                className="control-btn"
                                title="Move up"
                            >
                                ↑
                            </button>
                            <button 
                                onClick={() => onMoveBlock(block.id, 'down')}
                                className="control-btn"
                                title="Move down"
                            >
                                ↓
                            </button>
                            <button 
                                onClick={() => startEditing(block)}
                                className="control-btn"
                                title="Edit content"
                            >
                                ✏️
                            </button>
                            <button 
                                onClick={() => onDeleteBlock(block.id)}
                                className="control-btn delete"
                                title="Delete block"
                            >
                                🗑️
                            </button>
                        </div>
                        
                        <StyleEditor 
                            block={block}
                            onUpdateStyle={updateBlockStyle}
                        />
                    </div>
                )}
            </div>
        );
    };

    // Get theme-based background
    const getThemeBackground = () => {
        const backgrounds = {
            classic: 'linear-gradient(135deg, #faf7f0 0%, #f5f1e8 100%)',
            modern: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
            dark: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
            bold: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)'
        };
        return backgrounds[theme] || backgrounds.classic;
    };

    // Get theme text color
    const getThemeTextColor = () => {
        return theme === 'dark' ? '#ffffff' : '#333333';
    };

    return (
        <div className="live-preview">
            <div className="preview-header">
                <h3>Live Preview</h3>
                <div className="preview-info">
                    {siteConfig.username && (
                        <span className="site-url">
                            /site/{siteConfig.username}
                        </span>
                    )}
                </div>
            </div>
            
            <div 
                className="preview-content"
                style={{
                    background: getThemeBackground(),
                    color: getThemeTextColor(),
                    fontFamily: siteConfig.fontFamily,
                    minHeight: '500px',
                    padding: '40px',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb'
                }}
            >
                {siteConfig.blocks.length === 0 ? (
                    <div className="empty-preview">
                        <h3>Start building your website</h3>
                        <p>Add blocks from the sidebar to begin creating your site.</p>
                    </div>
                ) : (
                    siteConfig.blocks.map(renderBlock)
                )}
            </div>
        </div>
    );
};

// Style Editor Component
const StyleEditor = ({ block, onUpdateStyle }) => {
    const [showStyles, setShowStyles] = useState(false);

    const styleInputs = {
        fontSize: { type: 'range', min: 12, max: 72, step: 2, unit: 'px' },
        color: { type: 'color' },
        backgroundColor: { type: 'color' },
        textAlign: { type: 'select', options: ['left', 'center', 'right'] },
        fontWeight: { type: 'select', options: ['normal', 'bold', '600', '700'] },
        padding: { type: 'text', placeholder: '10px 20px' },
        margin: { type: 'text', placeholder: '10px auto' },
        borderRadius: { type: 'range', min: 0, max: 50, step: 1, unit: 'px' },
        width: { type: 'text', placeholder: '100%' },
        maxWidth: { type: 'text', placeholder: '500px' }
    };

    const getStyleValue = (property) => {
        const value = block.styles[property];
        if (property === 'fontSize' && typeof value === 'string') {
            return parseInt(value.replace('px', '')) || 16;
        }
        return value || '';
    };

    const handleStyleChange = (property, value) => {
        let finalValue = value;
        
        if (styleInputs[property]?.unit) {
            finalValue = `${value}${styleInputs[property].unit}`;
        }
        
        onUpdateStyle(block.id, property, finalValue);
    };

    return (
        <div className="style-editor">
            <button 
                onClick={() => setShowStyles(!showStyles)}
                className="control-btn"
            >
                🎨 Styles
            </button>
            
            {showStyles && (
                <div className="style-panel">
                    {Object.entries(styleInputs).map(([property, config]) => (
                        <div key={property} className="style-input-group">
                            <label>{property}</label>
                            
                            {config.type === 'range' && (
                                <div className="range-input">
                                    <input
                                        type="range"
                                        min={config.min}
                                        max={config.max}
                                        step={config.step}
                                        value={getStyleValue(property)}
                                        onChange={(e) => handleStyleChange(property, e.target.value)}
                                    />
                                    <span>{getStyleValue(property)}{config.unit}</span>
                                </div>
                            )}
                            
                            {config.type === 'color' && (
                                <input
                                    type="color"
                                    value={getStyleValue(property) || '#000000'}
                                    onChange={(e) => handleStyleChange(property, e.target.value)}
                                />
                            )}
                            
                            {config.type === 'select' && (
                                <select
                                    value={getStyleValue(property)}
                                    onChange={(e) => handleStyleChange(property, e.target.value)}
                                >
                                    {config.options.map(option => (
                                        <option key={option} value={option}>
                                            {option}
                                        </option>
                                    ))}
                                </select>
                            )}
                            
                            {config.type === 'text' && (
                                <input
                                    type="text"
                                    value={getStyleValue(property)}
                                    onChange={(e) => handleStyleChange(property, e.target.value)}
                                    placeholder={config.placeholder}
                                />
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LivePreview;