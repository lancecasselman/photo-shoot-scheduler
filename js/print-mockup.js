import Perspective from 'perspectivejs';

class PrintMockupGenerator {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.roomScenes = {
            living: {
                image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1600&h=900&fit=crop',
                printArea: {
                    topLeft: [380, 150],
                    topRight: [620, 160],
                    bottomRight: [615, 380],
                    bottomLeft: [375, 370]
                },
                // Standard sofa: 84" wide, art should be 66-75% of sofa width
                furnitureRef: {
                    type: 'sofa',
                    widthInches: 84,
                    artToFurnitureRatio: 0.66, // Conservative 66%
                    hangHeightAbove: 10, // Inches above sofa back
                    pixelsPerInch: 2.86 // Calibrated for this scene
                },
                wallWidth: 144,
                ambientLight: 0.9,
                description: 'Modern Living Room - Above Sofa'
            },
            bedroom: {
                image: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=1600&h=900&fit=crop',
                printArea: {
                    topLeft: [420, 180],
                    topRight: [580, 185],
                    bottomRight: [575, 350],
                    bottomLeft: [415, 345]
                },
                // Queen bed: 60" wide, art at 75% = 45" wide
                furnitureRef: {
                    type: 'bed',
                    widthInches: 60,
                    artToFurnitureRatio: 0.75,
                    hangHeightAbove: 12,
                    pixelsPerInch: 2.67
                },
                wallWidth: 120,
                ambientLight: 0.85,
                description: 'Cozy Bedroom - Above Headboard'
            },
            office: {
                image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&h=900&fit=crop',
                printArea: {
                    topLeft: [450, 140],
                    topRight: [550, 145],
                    bottomRight: [545, 280],
                    bottomLeft: [445, 275]
                },
                // Desk: 60" wide, art at 70% = 42" wide
                furnitureRef: {
                    type: 'desk',
                    widthInches: 60,
                    artToFurnitureRatio: 0.70,
                    hangHeightAbove: 14,
                    pixelsPerInch: 1.67
                },
                wallWidth: 96,
                ambientLight: 0.95,
                description: 'Home Office - Above Desk'
            },
            gallery: {
                image: 'https://images.unsplash.com/photo-1565538810643-b5bdb714032a?w=1600&h=900&fit=crop',
                printArea: {
                    topLeft: [350, 200],
                    topRight: [650, 200],
                    bottomRight: [650, 450],
                    bottomLeft: [350, 450]
                },
                // Gallery wall: center at 58" from floor
                furnitureRef: {
                    type: 'gallery',
                    widthInches: 96,
                    artToFurnitureRatio: 0.80,
                    centerHeight: 58,
                    pixelsPerInch: 3.13
                },
                wallWidth: 180,
                ambientLight: 1.0,
                description: 'Gallery Wall - Eye Level'
            },
            dining: {
                image: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1600&h=900&fit=crop',
                printArea: {
                    topLeft: [400, 120],
                    topRight: [600, 130],
                    bottomRight: [590, 360],
                    bottomLeft: [390, 350]
                },
                // Sideboard: 72" wide, art at 66% = 48" wide
                furnitureRef: {
                    type: 'sideboard',
                    widthInches: 72,
                    artToFurnitureRatio: 0.66,
                    hangHeightAbove: 8,
                    pixelsPerInch: 2.78
                },
                wallWidth: 132,
                ambientLight: 0.88,
                description: 'Dining Room - Above Sideboard'
            }
        };
        
        this.currentScene = null;
        this.printImage = null;
        this.frameStyles = {
            none: { padding: 0, color: null },
            black: { padding: 20, color: '#1a1a1a' },
            white: { padding: 20, color: '#ffffff' },
            wood: { padding: 25, color: '#8B4513' },
            gold: { padding: 15, color: '#FFD700' }
        };
        
        this.productStyles = {
            canvas: {
                depth: 1.5,
                texture: true,
                shadow: { blur: 20, offset: 10, opacity: 0.3 }
            },
            framed: {
                depth: 0,
                texture: false,
                shadow: { blur: 15, offset: 8, opacity: 0.25 }
            },
            metal: {
                depth: 0.5,
                texture: false,
                reflection: 0.1,
                shadow: { blur: 10, offset: 5, opacity: 0.2 }
            },
            acrylic: {
                depth: 1,
                texture: false,
                reflection: 0.2,
                shadow: { blur: 25, offset: 12, opacity: 0.35 }
            }
        };
    }
    
    async loadScene(sceneName) {
        const scene = this.roomScenes[sceneName];
        if (!scene) throw new Error(`Scene ${sceneName} not found`);
        
        return new Promise((resolve, reject) => {
            const sceneImage = new Image();
            sceneImage.crossOrigin = 'anonymous';
            
            sceneImage.onload = () => {
                this.currentScene = {
                    ...scene,
                    image: sceneImage
                };
                this.canvas.width = sceneImage.width;
                this.canvas.height = sceneImage.height;
                resolve();
            };
            
            sceneImage.onerror = reject;
            sceneImage.src = scene.image;
        });
    }
    
    async loadPrintImage(imageUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
                this.printImage = img;
                resolve();
            };
            
            img.onerror = reject;
            img.src = imageUrl;
        });
    }
    
    calculatePrintDimensions(printSize, scene) {
        const [printWidthInches, printHeightInches] = printSize.split('x').map(Number);
        const printAspectRatio = printWidthInches / printHeightInches;
        
        // Use furniture reference for accurate scaling
        const furnitureRef = scene.furnitureRef;
        const area = scene.printArea;
        
        // Calculate the actual wall space dimensions in pixels
        const areaWidth = Math.abs(area.topRight[0] - area.topLeft[0]);
        const areaHeight = Math.abs(area.bottomLeft[1] - area.topLeft[1]);
        
        // Apply the professional 66-75% rule for art above furniture
        let targetWidthInches;
        if (furnitureRef.type === 'gallery') {
            // For gallery walls, use more of the available space
            targetWidthInches = printWidthInches;
        } else {
            // For furniture, apply the ratio rule
            const maxArtWidth = furnitureRef.widthInches * furnitureRef.artToFurnitureRatio;
            targetWidthInches = Math.min(printWidthInches, maxArtWidth);
        }
        
        // Calculate the target height maintaining aspect ratio
        const targetHeightInches = targetWidthInches / printAspectRatio;
        
        // Use the calibrated pixels per inch for this scene
        const pixelsPerInch = furnitureRef.pixelsPerInch || 2.5;
        
        // Calculate final dimensions in pixels
        const finalWidth = targetWidthInches * pixelsPerInch;
        const finalHeight = targetHeightInches * pixelsPerInch;
        
        // Center the artwork in the designated area
        // Apply proper hanging height rules (8-12" above furniture)
        const centerX = (area.topLeft[0] + area.topRight[0]) / 2;
        let centerY = (area.topLeft[1] + area.bottomLeft[1]) / 2;
        
        // Adjust vertical placement based on furniture type
        if (furnitureRef.type !== 'gallery') {
            // Move artwork up slightly to simulate proper hanging height
            const hangOffset = (furnitureRef.hangHeightAbove || 10) * pixelsPerInch * 0.1;
            centerY -= hangOffset;
        }
        
        // Apply perspective distortion to match the wall angle
        const perspectiveFactor = 0.95; // Slight perspective for realism
        const topWidth = finalWidth * perspectiveFactor;
        const bottomWidth = finalWidth;
        
        return {
            topLeft: [centerX - topWidth/2, centerY - finalHeight/2],
            topRight: [centerX + topWidth/2, centerY - finalHeight/2],
            bottomRight: [centerX + bottomWidth/2, centerY + finalHeight/2],
            bottomLeft: [centerX - bottomWidth/2, centerY + finalHeight/2]
        };
    }
    
    applyProductStyle(productType, frameStyle = 'none') {
        const style = this.productStyles[productType];
        if (!style) return;
        
        this.ctx.save();
        
        if (style.shadow) {
            this.ctx.shadowColor = `rgba(0, 0, 0, ${style.shadow.opacity})`;
            this.ctx.shadowBlur = style.shadow.blur;
            this.ctx.shadowOffsetX = style.shadow.offset;
            this.ctx.shadowOffsetY = style.shadow.offset;
        }
        
        if (style.reflection) {
            this.ctx.globalAlpha = 1 - style.reflection;
        }
        
        this.ctx.restore();
    }
    
    drawFrame(corners, frameStyle) {
        const frame = this.frameStyles[frameStyle];
        if (!frame || frame.padding === 0) return;
        
        const padding = frame.padding;
        const expandedCorners = [
            [corners.topLeft[0] - padding, corners.topLeft[1] - padding],
            [corners.topRight[0] + padding, corners.topRight[1] - padding],
            [corners.bottomRight[0] + padding, corners.bottomRight[1] + padding],
            [corners.bottomLeft[0] - padding, corners.bottomLeft[1] + padding]
        ];
        
        this.ctx.save();
        this.ctx.fillStyle = frame.color;
        this.ctx.strokeStyle = frame.color;
        this.ctx.lineWidth = padding * 2;
        
        this.ctx.beginPath();
        this.ctx.moveTo(expandedCorners[0][0], expandedCorners[0][1]);
        for (let i = 1; i < expandedCorners.length; i++) {
            this.ctx.lineTo(expandedCorners[i][0], expandedCorners[i][1]);
        }
        this.ctx.closePath();
        this.ctx.stroke();
        
        this.ctx.restore();
    }
    
    addCanvasTexture() {
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            const noise = Math.random() * 10 - 5;
            data[i] = Math.min(255, Math.max(0, data[i] + noise));
            data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
            data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
        }
        
        this.ctx.putImageData(imageData, 0, 0);
    }
    
    drawSizeIndicator(printSize, printCorners) {
        // Draw a subtle size label below the print
        const bottomY = Math.max(printCorners.bottomLeft[1], printCorners.bottomRight[1]);
        const centerX = (printCorners.bottomLeft[0] + printCorners.bottomRight[0]) / 2;
        
        this.ctx.save();
        
        // Background for label
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        this.ctx.lineWidth = 1;
        
        const label = `${printSize}" Print`;
        this.ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const metrics = this.ctx.measureText(label);
        const padding = 8;
        
        const labelX = centerX - metrics.width / 2 - padding;
        const labelY = bottomY + 20;
        const labelWidth = metrics.width + padding * 2;
        const labelHeight = 24;
        
        // Draw label background
        this.ctx.beginPath();
        this.ctx.roundRect(labelX, labelY, labelWidth, labelHeight, 4);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Draw label text
        this.ctx.fillStyle = '#333';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(label, centerX, labelY + labelHeight / 2);
        
        this.ctx.restore();
    }
    
    async render(options = {}) {
        const {
            sceneName = 'living',
            printSize = '16x20',
            productType = 'canvas',
            frameStyle = 'none',
            cropSettings = { zoom: 100, x: 0, y: 0 },
            showSizeIndicator = true
        } = options;
        
        if (!this.currentScene || this.currentScene.name !== sceneName) {
            await this.loadScene(sceneName);
        }
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(this.currentScene.image, 0, 0);
        
        if (!this.printImage) return;
        
        const printCorners = this.calculatePrintDimensions(printSize, this.currentScene);
        
        if (frameStyle !== 'none') {
            this.drawFrame(printCorners, frameStyle);
        }
        
        this.applyProductStyle(productType, frameStyle);
        
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = this.printImage.width;
        tempCanvas.height = this.printImage.height;
        
        tempCtx.save();
        const scale = cropSettings.zoom / 100;
        tempCtx.translate(tempCanvas.width/2, tempCanvas.height/2);
        tempCtx.scale(scale, scale);
        tempCtx.translate(-tempCanvas.width/2 + cropSettings.x, -tempCanvas.height/2 + cropSettings.y);
        tempCtx.drawImage(this.printImage, 0, 0);
        tempCtx.restore();
        
        const perspective = new Perspective(this.ctx, tempCanvas);
        perspective.draw([
            printCorners.topLeft,
            printCorners.topRight,
            printCorners.bottomRight,
            printCorners.bottomLeft
        ]);
        
        if (productType === 'canvas' && this.productStyles.canvas.texture) {
            this.addCanvasTexture();
        }
        
        const ambientLight = this.currentScene.ambientLight;
        if (ambientLight < 1) {
            this.ctx.fillStyle = `rgba(0, 0, 0, ${1 - ambientLight})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        // Draw size indicator if enabled
        if (showSizeIndicator) {
            this.drawSizeIndicator(printSize, printCorners);
        }
    }
}

window.PrintMockupGenerator = PrintMockupGenerator;
export default PrintMockupGenerator;