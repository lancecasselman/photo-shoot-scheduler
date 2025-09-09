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
                wallWidth: 144,
                ambientLight: 0.9,
                description: 'Modern Living Room'
            },
            bedroom: {
                image: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=1600&h=900&fit=crop',
                printArea: {
                    topLeft: [420, 180],
                    topRight: [580, 185],
                    bottomRight: [575, 350],
                    bottomLeft: [415, 345]
                },
                wallWidth: 120,
                ambientLight: 0.85,
                description: 'Cozy Bedroom'
            },
            office: {
                image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&h=900&fit=crop',
                printArea: {
                    topLeft: [450, 140],
                    topRight: [550, 145],
                    bottomRight: [545, 280],
                    bottomLeft: [445, 275]
                },
                wallWidth: 96,
                ambientLight: 0.95,
                description: 'Home Office'
            },
            gallery: {
                image: 'https://images.unsplash.com/photo-1565538810643-b5bdb714032a?w=1600&h=900&fit=crop',
                printArea: {
                    topLeft: [350, 200],
                    topRight: [650, 200],
                    bottomRight: [650, 450],
                    bottomLeft: [350, 450]
                },
                wallWidth: 180,
                ambientLight: 1.0,
                description: 'Gallery Wall'
            },
            dining: {
                image: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1600&h=900&fit=crop',
                printArea: {
                    topLeft: [400, 120],
                    topRight: [600, 130],
                    bottomRight: [590, 360],
                    bottomLeft: [390, 350]
                },
                wallWidth: 132,
                ambientLight: 0.88,
                description: 'Dining Room'
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
        const [width, height] = printSize.split('x').map(Number);
        const aspectRatio = width / height;
        
        const area = scene.printArea;
        const areaWidth = Math.abs(area.topRight[0] - area.topLeft[0]);
        const areaHeight = Math.abs(area.bottomLeft[1] - area.topLeft[1]);
        const areaAspect = areaWidth / areaHeight;
        
        let scaledWidth, scaledHeight;
        
        if (aspectRatio > areaAspect) {
            scaledWidth = areaWidth;
            scaledHeight = areaWidth / aspectRatio;
        } else {
            scaledHeight = areaHeight;
            scaledWidth = areaHeight * aspectRatio;
        }
        
        const scale = Math.min(scaledWidth / width, scaledHeight / height);
        const pixelsPerInch = scale * (scene.wallWidth / 144);
        
        const finalWidth = width * pixelsPerInch * 3;
        const finalHeight = height * pixelsPerInch * 3;
        
        const centerX = (area.topLeft[0] + area.topRight[0]) / 2;
        const centerY = (area.topLeft[1] + area.bottomLeft[1]) / 2;
        
        return {
            topLeft: [centerX - finalWidth/2, centerY - finalHeight/2],
            topRight: [centerX + finalWidth/2, centerY - finalHeight/2],
            bottomRight: [centerX + finalWidth/2, centerY + finalHeight/2],
            bottomLeft: [centerX - finalWidth/2, centerY + finalHeight/2]
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
    
    async render(options = {}) {
        const {
            sceneName = 'living',
            printSize = '16x20',
            productType = 'canvas',
            frameStyle = 'none',
            cropSettings = { zoom: 100, x: 0, y: 0 }
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
    }
}

window.PrintMockupGenerator = PrintMockupGenerator;
export default PrintMockupGenerator;