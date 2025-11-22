/**
 * Adaptive Layer Manager
 * 
 * Dynamically expands or contracts model layers based on task complexity
 * and computational constraints.
 */

export interface LayerConfig {
    minLayers: number;
    maxLayers: number;
    expansionThreshold: number;
    contractionThreshold: number;
}

export interface Layer {
    id: string;
    type: 'attention' | 'convolution' | 'normalization' | 'activation';
    params: any;
    active: boolean;
    complexity: number;
}

export class AdaptiveLayerManager {
    private config: LayerConfig;
    private layers: Layer[];
    private complexityHistory: number[];
    
    constructor(config: LayerConfig) {
        this.config = config;
        this.layers = [];
        this.complexityHistory = [];
        this.initializeBaseLayers();
    }

    private initializeBaseLayers(): void {
        for (let i = 0; i < this.config.minLayers; i++) {
            this.layers.push({
                id: `layer_${i}`,
                type: 'attention',
                params: {},
                active: true,
                complexity: 1.0
            });
        }
    }

    /**
     * Analyze task complexity and adjust layers accordingly
     */
    public adaptLayers(taskComplexity: number): void {
        this.complexityHistory.push(taskComplexity);
        
        // Maintain rolling window of complexity metrics
        if (this.complexityHistory.length > 10) {
            this.complexityHistory.shift();
        }

        const avgComplexity = this.getAverageComplexity();

        if (avgComplexity > this.config.expansionThreshold && 
            this.getActiveLayerCount() < this.config.maxLayers) {
            this.expandLayers();
        } else if (avgComplexity < this.config.contractionThreshold && 
                   this.getActiveLayerCount() > this.config.minLayers) {
            this.contractLayers();
        }
    }

    private expandLayers(): void {
        const newLayer: Layer = {
            id: `layer_${this.layers.length}`,
            type: this.selectLayerType(),
            params: {},
            active: true,
            complexity: 1.0
        };
        this.layers.push(newLayer);
        console.log(`Expanded architecture: Added ${newLayer.type} layer`);
    }

    private contractLayers(): void {
        // Find least important layer to deactivate
        const activeLayers = this.layers.filter(l => l.active);
        if (activeLayers.length > this.config.minLayers) {
            const leastImportant = this.findLeastImportantLayer(activeLayers);
            leastImportant.active = false;
            console.log(`Contracted architecture: Deactivated layer ${leastImportant.id}`);
        }
    }

    private selectLayerType(): Layer['type'] {
        const types: Layer['type'][] = ['attention', 'convolution', 'normalization', 'activation'];
        const avgComplexity = this.getAverageComplexity();
        
        // Higher complexity tasks benefit from more attention layers
        if (avgComplexity > 0.7) {
            return 'attention';
        } else if (avgComplexity > 0.4) {
            return 'convolution';
        } else {
            return types[Math.floor(Math.random() * types.length)];
        }
    }

    private findLeastImportantLayer(layers: Layer[]): Layer {
        // Simple heuristic: oldest layer with lowest complexity
        return layers.reduce((least, current) => 
            current.complexity < least.complexity ? current : least
        );
    }

    private getActiveLayerCount(): number {
        return this.layers.filter(l => l.active).length;
    }

    private getAverageComplexity(): number {
        if (this.complexityHistory.length === 0) return 0.5;
        return this.complexityHistory.reduce((a, b) => a + b, 0) / this.complexityHistory.length;
    }

    public getActiveLayers(): Layer[] {
        return this.layers.filter(l => l.active);
    }

    public getArchitectureInfo(): { totalLayers: number; activeLayers: number; avgComplexity: number } {
        return {
            totalLayers: this.layers.length,
            activeLayers: this.getActiveLayerCount(),
            avgComplexity: this.getAverageComplexity()
        };
    }
}
