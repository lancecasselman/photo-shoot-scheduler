const SimpleSiteBuilder = () => {
    console.log('SimpleSiteBuilder rendering...');
    
    return React.createElement(
        'div',
        {
            style: {
                display: 'grid',
                gridTemplateColumns: '300px 1fr 300px',
                height: '100vh',
                gap: '20px',
                padding: '20px',
                background: '#f8fafc',
                fontFamily: 'Arial, sans-serif'
            }
        },
        
        // Left Sidebar
        React.createElement(
            'div',
            { 
                style: {
                    background: 'white',
                    borderRadius: '12px',
                    padding: '20px',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
                }
            },
            React.createElement('h3', { style: { margin: '0 0 20px 0', color: '#1f2937' } }, '🔧 Tools'),
            React.createElement('p', { style: { color: '#6b7280', fontSize: '14px' } }, 'Page manager, templates, and block library will appear here.'),
            React.createElement('div', { 
                style: { 
                    background: '#f3f4f6', 
                    padding: '15px', 
                    borderRadius: '8px', 
                    marginTop: '20px' 
                } 
            }, 'Block Library Loading...')
        ),
        
        // Center Preview
        React.createElement(
            'div',
            {
                style: {
                    background: 'white',
                    borderRadius: '12px',
                    padding: '20px',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
                    overflow: 'auto'
                }
            },
            React.createElement('h2', { 
                style: { 
                    margin: '0 0 20px 0', 
                    color: '#1f2937',
                    textAlign: 'center'
                } 
            }, '📱 Live Preview'),
            React.createElement('div', {
                style: {
                    background: '#f9fafb',
                    border: '2px dashed #d1d5db',
                    borderRadius: '8px',
                    padding: '40px',
                    textAlign: 'center',
                    color: '#6b7280'
                }
            }, 
            React.createElement('h3', { style: { margin: '0 0 10px 0' } }, 'Welcome to My Photography'),
            React.createElement('p', { style: { margin: 0 } }, 'Professional photography services capturing life\'s most precious moments.')
            )
        ),

        // Right Sidebar
        React.createElement(
            'div',
            { 
                style: {
                    background: 'white',
                    borderRadius: '12px',
                    padding: '20px',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
                }
            },
            React.createElement('h3', { style: { margin: '0 0 20px 0', color: '#1f2937' } }, '⚙️ Settings'),
            
            React.createElement('div', { style: { marginBottom: '20px' } },
                React.createElement('label', { style: { display: 'block', marginBottom: '8px', fontWeight: '600' } }, 'Theme'),
                React.createElement('select', {
                    style: {
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px'
                    }
                },
                React.createElement('option', null, 'Classic Gold')
                )
            ),
            
            React.createElement('div', { style: { marginBottom: '20px' } },
                React.createElement('label', { style: { display: 'block', marginBottom: '8px', fontWeight: '600' } }, 'Username'),
                React.createElement('input', {
                    type: 'text',
                    placeholder: 'photographer',
                    style: {
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px'
                    }
                })
            ),
            
            React.createElement('button', {
                style: {
                    width: '100%',
                    padding: '12px 16px',
                    marginBottom: '12px',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer'
                },
                onClick: () => alert('Save functionality working!')
            }, '💾 Save Website'),
            
            React.createElement('button', {
                style: {
                    width: '100%',
                    padding: '12px 16px',
                    background: 'linear-gradient(135deg, #D4AF37 0%, #FFD700 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer'
                },
                onClick: () => alert('Publish functionality working!')
            }, '🚀 Publish Website')
        )
    );
};

window.SimpleSiteBuilder = SimpleSiteBuilder;