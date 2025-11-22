/**
 * Progressive Multi-Scale Refinement
 * 
 * Implements a hierarchical generation pipeline that produces fast previews
 * followed by progressive refinement to high resolution.
 */

export interface RefinementConfig {
    scales: number[];
    refinementSteps: number;
    qualityThreshold: number;
}

export interface GenerationResult {
    preview: ImageData;
    final: ImageData | null;
    quality: number;
    generationTime: number;
}

export class ProgressiveMultiScaleRefinement {
    private config: RefinementConfig;
    private currentScale: number;
    
    constructor(config: RefinementConfig) {
        this.config = config;
        this.currentScale = 0;
    }

    /**
     * Generate image with progressive refinement
     */
    public async generateProgressive(
        prompt: string,
        baseGenerator: (prompt: string, scale: number) => Promise<ImageData>,
        onProgress?: (scale: number, quality: number) => void
    ): Promise<GenerationResult> {
        const startTime = performance.now();
        
        // Start with lowest resolution for fast preview
        const previewScale = this.config.scales[0];
        const preview = await baseGenerator(prompt, previewScale);
        
        if (onProgress) {
            onProgress(previewScale, 0.3);
        }

        // Progressive refinement
        let currentImage = preview;
        let quality = 0.3;

        for (let i = 1; i < this.config.scales.length; i++) {
            const scale = this.config.scales[i];
            currentImage = await this.refineAtScale(
                currentImage,
                prompt,
                scale,
                baseGenerator
            );
            
            quality = this.estimateQuality(currentImage, i / this.config.scales.length);
            
            if (onProgress) {
                onProgress(scale, quality);
            }

            // Early stopping if quality threshold met
            if (quality >= this.config.qualityThreshold) {
                break;
            }
        }

        const generationTime = performance.now() - startTime;

        return {
            preview,
            final: currentImage,
            quality,
            generationTime
        };
    }

    /**
     * Refine image at specific scale
     */
    private async refineAtScale(
        currentImage: ImageData,
        prompt: string,
        scale: number,
        generator: (prompt: string, scale: number) => Promise<ImageData>
    ): Promise<ImageData> {
        // Upscale current image
        const upscaled = this.upscaleImage(currentImage, scale);
        
        // Generate at new scale
        const newGeneration = await generator(prompt, scale);
        
        // Blend with upscaled version for smooth transition
        return this.blendImages(upscaled, newGeneration, 0.3);
    }

    private upscaleImage(image: ImageData, targetScale: number): ImageData {
        const newWidth = Math.floor(image.width * targetScale);
        const newHeight = Math.floor(image.height * targetScale);
        
        const canvas = document.createElement('canvas');
        canvas.width = newWidth;
        canvas.height = newHeight;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
            return image;
        }

        // Create temporary canvas for source image
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = image.width;
        tempCanvas.height = image.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        if (tempCtx) {
            tempCtx.putImageData(image, 0, 0);
            ctx.drawImage(tempCanvas, 0, 0, newWidth, newHeight);
        }

        return ctx.getImageData(0, 0, newWidth, newHeight);
    }

    private blendImages(imageA: ImageData, imageB: ImageData, alpha: number): ImageData {
        const blended = new ImageData(imageA.width, imageA.height);
        
        for (let i = 0; i < imageA.data.length; i++) {
            blended.data[i] = imageA.data[i] * (1 - alpha) + imageB.data[i] * alpha;
        }
        
        return blended;
    }

    private estimateQuality(image: ImageData, progress: number): number {
        // Simple quality estimation based on variance and detail
        const variance = this.calculateVariance(image);
        const edgeStrength = this.calculateEdgeStrength(image);
        
        // Combine metrics with progress
        return Math.min(1.0, (variance * 0.3 + edgeStrength * 0.3 + progress * 0.4));
    }

    private calculateVariance(image: ImageData): number {
        let sum = 0;
        let sumSquared = 0;
        const pixelCount = image.data.length / 4;
        
        for (let i = 0; i < image.data.length; i += 4) {
            const gray = (image.data[i] + image.data[i + 1] + image.data[i + 2]) / 3;
            sum += gray;
            sumSquared += gray * gray;
        }
        
        const mean = sum / pixelCount;
        const variance = (sumSquared / pixelCount) - (mean * mean);
        
        return Math.min(1.0, variance / 10000); // Normalize
    }

    private calculateEdgeStrength(image: ImageData): number {
        let edgeStrength = 0;
        const width = image.width;
        
        for (let i = 0; i < image.data.length - 4; i += 4) {
            if ((i / 4) % width === width - 1) continue; // Skip last pixel in row
            
            const current = image.data[i];
            const next = image.data[i + 4];
            edgeStrength += Math.abs(current - next);
        }
        
        return Math.min(1.0, edgeStrength / (image.data.length * 50)); // Normalize
    }

    /**
     * Generate fast preview only
     */
    public async generatePreview(
        prompt: string,
        generator: (prompt: string, scale: number) => Promise<ImageData>
    ): Promise<ImageData> {
        return generator(prompt, this.config.scales[0]);
    }
}
