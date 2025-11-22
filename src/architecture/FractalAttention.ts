/**
 * Fractal Attention Mechanism
 * 
 * Implements a novel fractal-based attention pattern that recursively subdivides
 * attention across multiple scales, enabling hierarchical feature learning.
 */

export interface FractalAttentionConfig {
    depth: number;
    headCount: number;
    scalingFactor: number;
    sparsityThreshold: number;
}

export class FractalAttention {
    private config: FractalAttentionConfig;
    private attentionMaps: Map<number, Float32Array>;
    
    constructor(config: FractalAttentionConfig) {
        this.config = config;
        this.attentionMaps = new Map();
    }

    /**
     * Compute fractal attention across multiple scales
     */
    public computeAttention(
        query: Float32Array,
        key: Float32Array,
        value: Float32Array,
        scale: number = 0
    ): Float32Array {
        if (scale >= this.config.depth) {
            return this.computeBaseAttention(query, key, value);
        }

        // Recursive fractal subdivision
        const subQueries = this.subdivide(query, this.config.scalingFactor);
        const subKeys = this.subdivide(key, this.config.scalingFactor);
        const subValues = this.subdivide(value, this.config.scalingFactor);

        const results: Float32Array[] = [];
        for (let i = 0; i < subQueries.length; i++) {
            const subResult = this.computeAttention(
                subQueries[i],
                subKeys[i],
                subValues[i],
                scale + 1
            );
            results.push(subResult);
        }

        return this.merge(results);
    }

    private computeBaseAttention(
        query: Float32Array,
        key: Float32Array,
        value: Float32Array
    ): Float32Array {
        const scores = this.dotProduct(query, key);
        const weights = this.softmax(scores);
        return this.applyWeights(value, weights);
    }

    private subdivide(tensor: Float32Array, factor: number): Float32Array[] {
        const subdivisions: Float32Array[] = [];
        const chunkSize = Math.floor(tensor.length / factor);
        
        for (let i = 0; i < factor; i++) {
            const start = i * chunkSize;
            const end = i === factor - 1 ? tensor.length : start + chunkSize;
            subdivisions.push(tensor.slice(start, end));
        }
        
        return subdivisions;
    }

    private merge(tensors: Float32Array[]): Float32Array {
        const totalLength = tensors.reduce((sum, t) => sum + t.length, 0);
        const result = new Float32Array(totalLength);
        let offset = 0;
        
        for (const tensor of tensors) {
            result.set(tensor, offset);
            offset += tensor.length;
        }
        
        return result;
    }

    private dotProduct(a: Float32Array, b: Float32Array): Float32Array {
        const result = new Float32Array(a.length);
        for (let i = 0; i < a.length; i++) {
            result[i] = a[i] * (b[i] || 0);
        }
        return result;
    }

    private softmax(scores: Float32Array): Float32Array {
        const max = Math.max(...scores);
        const exps = scores.map(s => Math.exp(s - max));
        const sum = exps.reduce((a, b) => a + b, 0);
        return new Float32Array(exps.map(e => e / sum));
    }

    private applyWeights(values: Float32Array, weights: Float32Array): Float32Array {
        const result = new Float32Array(values.length);
        for (let i = 0; i < values.length; i++) {
            result[i] = values[i] * (weights[i] || 0);
        }
        return result;
    }

    /**
     * Apply sparsity to attention for memory efficiency
     */
    public applySparse(attention: Float32Array): Float32Array {
        const threshold = this.config.sparsityThreshold;
        return attention.map(val => val < threshold ? 0 : val);
    }
}
