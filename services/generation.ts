import { GoogleGenAI, GenerateContentResponse, Modality, Type } from "@google/genai";

export interface GenerationProvider {
    generate(params: any): Promise<any>;
}

export class GoogleAIProvider implements GenerationProvider {
    private ai: GoogleGenAI;
    private apiKey: string;

    constructor(apiKey: string) {
        this.ai = new GoogleGenAI({ apiKey });
        this.apiKey = apiKey;
    }

    async generate(params: any): Promise<any> {
        if (params.type === 'ENHANCE_PROMPT') {
            return this.enhancePrompt(params.prompt, params.context);
        }
        if (params.type === 'GENERATE_METADATA') {
            return this.generateImageMetadata(params.image);
        }
        if (params.type === 'GENERATE_VIDEO_METADATA') {
            return this.generateVideoMetadata(params.prompt);
        }
        if (params.type === 'GENERATE_AUDIO_METADATA') {
            return this.generateAudioMetadata(params.prompt);
        }
        if (params.type === 'INPAINT') {
            return this.inpaint(params.image, params.mask, params.prompt, params.creativity);
        }
        if (params.type === 'FACE_SWAP') {
            return this.faceSwap(params.sourceImage, params.faceRefImage, params.mask, params.faceFidelity, params.colorMatching, params.prompt);
        }
        if (params.type === 'BLEND') {
            return this.blend(params.images, params.faceRefImage, params.blendMode, params.technicalBlendMode, params.prompt, params.model, params.numberOfImages, params.aspectRatio);
        }
        if (params.type === 'STYLE_TRANSFER') {
            return this.styleTransfer(params.contentImage, params.styleImage, params.strength, params.prompt);
        }
        if (params.type === 'VIDEO') {
            return this.video(params.job);
        }
        if (params.type === 'AUDIO') {
            return this.audio(params.prompt, params.voiceType);
        }

        throw new Error(`Unknown generation type: ${params.type}`);
    }

    private async enhancePrompt(prompt: string, context: string): Promise<any> {
        const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `You are an expert prompt engineer for generative AI. Your task is to take a user's idea and expand it into a rich, detailed, and evocative prompt. Your enhanced prompt should include specific keywords for style (e.g., 'cinematic lighting', 'impressionistic'), mood, and composition (e.g., 'low-angle shot', 'dutch angle'), and be structured for maximum impact. Return ONLY the enhanced prompt, without any conversational text or markdown.

            Context: The user wants to generate content for "${context}".

            User's Prompt: "${prompt}"`
        });
        return { text: response.text };
    }

    private async generateImageMetadata(image: { mimeType: string; data: string; }): Promise<any> {
        const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: image },
                    { text: 'Analyze this image. Generate a creative, descriptive 3-word file name and 3-4 relevant metadata tags for searching. The name should be lowercase with words separated by hyphens.' }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING, description: 'A 3-word lowercase file name, e.g., "surreal-cat-portrait".' },
                        tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'An array of 3-4 string tags.' }
                    },
                    required: ['name', 'tags']
                }
            }
        });
        return { metadata: JSON.parse(response.text) };
    }

    private async generateVideoMetadata(prompt: string): Promise<any> {
        const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { text: `Based on this video description, generate a creative, descriptive 3-word file name and 3-4 relevant metadata tags for searching. The name should be lowercase with words separated by hyphens. Description: "${prompt}"` }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING, description: 'A 3-word lowercase file name, e.g., "futuristic-city-scape".' },
                        tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'An array of 3-4 string tags.' }
                    },
                    required: ['name', 'tags']
                }
            }
        });
        return { metadata: JSON.parse(response.text) };
    }

    private async generateAudioMetadata(prompt: string): Promise<any> {
        const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { text: `Based on this audio description, generate a creative, descriptive 3-word file name and 3-4 relevant search tags. The name should be lowercase with words separated by hyphens. Description: "${prompt}"` }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING, description: 'A 3-word lowercase file name, e.g., "deep-space-ambience".' },
                        tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'An array of 3-4 string tags.' }
                    },
                    required: ['name', 'tags']
                }
            }
        });
        return { metadata: JSON.parse(response.text) };
    }

    private async inpaint(image: string, mask: string, prompt: string, creativity: number): Promise<any> {
        const creativityPrompt = `Apply this with ${creativity}% creativity, where 100% is maximum artistic freedom and 0% is a very literal interpretation.`;
        const fullPrompt = `You are a master digital artist specializing in photorealistic inpainting. Your task is to seamlessly edit an image based on a user's prompt and a mask. The first image is the source. The second image is the mask. You must edit the source image ONLY in the area indicated by the mask. Your edits should blend perfectly with the surrounding image, matching lighting, shadows, and texture. The user wants to: '${prompt}'. ${creativityPrompt}`;

        const sourceImagePart = { inlineData: { mimeType: image.split(';')[0].split(':')[1], data: image.split(',')[1] } };
        const maskPart = { inlineData: { mimeType: 'image/png', data: mask.split(',')[1] } };

        const response: GenerateContentResponse = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: [sourceImagePart, maskPart, { text: fullPrompt }] },
            config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
        });

        const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

        if (imagePart?.inlineData) {
            const base64ImageBytes = imagePart.inlineData.data;
            const mimeType = imagePart.inlineData.mimeType;
            const newImage = `data:${mimeType};base64,${base64ImageBytes}`;
            return { image: newImage };
        } else {
            const textPart = response.candidates?.[0]?.content?.parts?.find(part => part.text)?.text;
            let errorMessage = 'Generation succeeded, but the model did not return an image.';
            if (textPart) {
                errorMessage += ` Model response: "${textPart}"`;
            } else {
                errorMessage += ' This might be due to safety filters. Please try modifying your prompt or images.';
            }
            return { error: errorMessage };
        }
    }

    private async faceSwap(sourceImage: string, faceRefImage: string, mask: string | null, faceFidelity: number, colorMatching: number, prompt: string): Promise<any> {
        const newPrompt = `You are an expert in digital image manipulation. Your task is to perform a photorealistic face swap. Replace the face in the first image (the source) with the face from the ${mask ? 'third' : 'second'} image (the reference face). ${mask ? 'The second image is a mask indicating the exact area on the source image where the swap should occur.' : ''} The final image must be seamless. Match the reference face features with ${faceFidelity}% fidelity. Adapt the lighting and skin tone to the source image with ${colorMatching}% intensity. Apply the user's guidance: '${prompt || 'Ensure the result is photorealistic and natural.'}'`;

        const sourceImagePart = { inlineData: { mimeType: sourceImage.split(';')[0].split(':')[1], data: sourceImage.split(',')[1] } };
        const faceRefPart = { inlineData: { mimeType: faceRefImage.split(';')[0].split(':')[1], data: faceRefImage.split(',')[1] } };

        const parts = [
            sourceImagePart,
            ...(mask ? [{ inlineData: { mimeType: 'image/png', data: mask.split(',')[1] } }] : []),
            faceRefPart,
            { text: newPrompt },
        ];

        const response: GenerateContentResponse = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts },
            config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
        });

        const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

        if (imagePart?.inlineData) {
            const base64ImageBytes = imagePart.inlineData.data;
            const mimeType = imagePart.inlineData.mimeType;
            const newImage = `data:${mimeType};base64,${base64ImageBytes}`;
            return { image: newImage };
        } else {
            const textPart = response.candidates?.[0]?.content?.parts?.find(part => part.text)?.text;
            let errorMessage = 'Generation succeeded, but the model did not return an image.';
            if (textPart) {
                errorMessage += ` Model response: "${textPart}"`;
            } else {
                errorMessage += ' This might be due to safety filters. Please try modifying your prompt or images.';
            }
            return { error: errorMessage };
        }
    }

    private async blend(images: any[], faceRefImage: string | null, blendMode: string, technicalBlendMode: string, prompt: string, model: string, numberOfImages: number, aspectRatio: string): Promise<any> {
        const validImages = images.filter(img => img.src);
        const textParts = [`As an expert art director, analyze the provided images. Create a single, detailed, and vivid prompt for an AI image generator.`];
        if (faceRefImage) textParts.push(`The first image is a face reference; this person must be prominently featured in the final image.`);
        textParts.push(`The other images provide the scene, subjects, and style elements. Specific instructions for each image are as follows:`);

        validImages.forEach((img, index) => {
            let instructionText = `Image ${index + 1}`;
            const { transform, instruction } = img;
            if (transform.scale !== 1 || transform.x !== 0 || transform.y !== 0) {
                instructionText += ` (framed with a ${transform.scale.toFixed(1)}x zoom, positioned at x:${transform.x.toFixed(0)}, y:${transform.y.toFixed(0)})`;
            }
            if (instruction) {
                instructionText += `: "${instruction}"`;
            }
            textParts.push(instructionText);
        });

        textParts.push(`Creatively combine all these elements, interpreted through the artistic lens of '${blendMode}'.`);
        if (technicalBlendMode !== 'Normal') {
            textParts.push(`Apply a '${technicalBlendMode}' technical blend effect to harmonize the images.`);
        }
        if (prompt) textParts.push(`Weave in the user's specific guidance: '${prompt}'.`);
        textParts.push(`Your response must be ONLY the resulting creative prompt, ready to be used by an image generation model. Do not include any other text, conversation, or explanations.`);

        const imageInputs = [];
        if (faceRefImage) imageInputs.push(faceRefImage);
        imageInputs.push(...validImages.map(img => img.src as string));

        const imageParts = imageInputs.map(img => ({ inlineData: { mimeType: img.split(';')[0].split(':')[1], data: img.split(',')[1] } }));

        const visionResponse: GenerateContentResponse = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [...imageParts, { text: textParts.join(' ') }] },
        });

        const descriptivePrompt = visionResponse.text;
        if (!descriptivePrompt) {
            return { error: 'Could not generate a descriptive prompt from the source images.' };
        }

        const imageResponse = await this.ai.models.generateImages({
            model: model,
            prompt: descriptivePrompt,
            config: {
                numberOfImages: numberOfImages,
                outputMimeType: 'image/jpeg',
                aspectRatio: aspectRatio as "1:1" | "3:4" | "4:3" | "9:16" | "16:9",
            },
        });

        const newImages = imageResponse.generatedImages.map(img => `data:image/jpeg;base64,${img.image.imageBytes}`);
        return { images: newImages };
    }

    private async styleTransfer(contentImage: string, styleImage: string, strength: number, prompt: string): Promise<any> {
        const fullPrompt = `You are a master of artistic style transfer. Your task is to apply the visual style of the second image (the style reference) to the first image (the content). The result should retain the core subject and composition of the content image, but be completely reimagined in the artistic style of the reference image. The desired strength of the style transfer is ${strength}%. ${prompt ? `Additional guidance: '${prompt}'` : ''}`;

        const contentImagePart = { inlineData: { mimeType: contentImage.split(';')[0].split(':')[1], data: contentImage.split(',')[1] } };
        const styleImagePart = { inlineData: { mimeType: styleImage.split(';')[0].split(':')[1], data: styleImage.split(',')[1] } };

        const response: GenerateContentResponse = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: [contentImagePart, styleImagePart, { text: fullPrompt }] },
            config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
        });

        const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

        if (imagePart?.inlineData) {
            const base64ImageBytes = imagePart.inlineData.data;
            const mimeType = imagePart.inlineData.mimeType;
            const newImage = `data:${mimeType};base64,${base64ImageBytes}`;
            return { image: newImage };
        } else {
            const textPart = response.candidates?.[0]?.content?.parts?.find(part => part.text)?.text;
            let errorMessage = 'Generation succeeded, but the model did not return an image.';
            if (textPart) {
                errorMessage += ` Model response: "${textPart}"`;
            } else {
                errorMessage += ' This might be due to safety filters. Please try modifying your prompt or images.';
            }
            return { error: errorMessage };
        }
    }

    private async video(job: any): Promise<any> {
        let finalPrompt = job.videoPrompt;

        if (job.videoStyleImage) {
            const styleImagePart = { inlineData: { mimeType: job.videoStyleImage.split(';')[0].split(':')[1], data: job.videoStyleImage.split(',')[1] } };
            const styleDescriptionPrompt = "Describe the artistic style of this image in detail. Focus on color palette, lighting, texture, mood, and genre (e.g., 'impressionistic', 'cyberpunk', 'watercolor').";

            const styleResponse = await this.ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [styleImagePart, { text: styleDescriptionPrompt }] },
            });

            const styleDescription = styleResponse.text.trim();
            if (styleDescription) {
                finalPrompt = `Render this video in the following artistic style: "${styleDescription}". The scene is: ${finalPrompt}`;
            }
        }

        if (job.videoBlendMode) {
            finalPrompt = `In the artistic mood of '${job.videoBlendMode}', create a video of: ${finalPrompt}`;
        }
        if (job.videoFaceRefImage) {
            finalPrompt += `. The main character should look like the person in the provided reference image.`;
        }
        if (job.videoDialogue) {
            finalPrompt += ` A character in the scene is speaking and their lip movements should match this dialogue: "${job.videoDialogue}"`;
        }

        const generateVideosParams: { model: string, prompt: string, image?: { imageBytes: string, mimeType: string }, config: any } = {
            model: 'veo-2.0-generate-001',
            prompt: finalPrompt,
            config: { numberOfVideos: 1 }
        };

        const validVideoImages = job.videoImages.filter((img: string | null) => img) as string[];
        const primaryImage = job.videoFaceRefImage || validVideoImages[0];

        if (primaryImage) {
            generateVideosParams.image = {
                imageBytes: primaryImage.split(',')[1],
                mimeType: primaryImage.split(';')[0].split(':')[1],
            };
        }

        let operation = await this.ai.models.generateVideos(generateVideosParams);

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await this.ai.operations.getVideosOperation({ operation: operation });
        }

        if (operation.error) {
            return { error: `Video generation failed with an error: ${operation.error.message} (Code: ${operation.error.code})` };
        }

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!downloadLink) {
            return { error: 'Video generation completed, but no video was returned. This may be due to safety filters or an issue with the prompt/images. Please try adjusting your inputs.' };
        }

        const videoResponse = await fetch(`${downloadLink}&key=${this.apiKey}`);
        if (!videoResponse.ok) {
            return { error: `Failed to download video: ${videoResponse.statusText}` };
        }

        const videoBlob = await videoResponse.blob();
        const videoUrl = URL.createObjectURL(videoBlob);
        return { videoUrl: videoUrl };
    }

    private async audio(prompt: string, voiceType: string): Promise<any> {
        // Placeholder for audio generation logic
        await new Promise(resolve => setTimeout(resolve, 4000));
        return { error: 'Audio generation feature is currently under development and not yet available.' };
    }
}

export class OllamaProvider implements GenerationProvider {
    private serverUrl: string;
    private model: string;

    constructor(serverUrl: string, model: string) {
        this.serverUrl = serverUrl;
        this.model = model;
    }

    async generate(params: any): Promise<any> {
        if (params.type === 'ENHANCE_PROMPT') {
            return this.enhancePrompt(params.prompt, params.context);
        }

        if (params.type === 'BLEND') {
            return this.blend(params.images, params.faceRefImage, params.blendMode, params.technicalBlendMode, params.prompt, params.model, params.numberOfImages, params.aspectRatio);
        }
        if (params.type === 'INPAINT') {
            return this.inpaint(params.image, params.mask, params.prompt, params.creativity);
        }
        if (params.type === 'FACE_SWAP') {
            return Promise.resolve({ error: 'Face Swap is not yet available for the local backend.' });
        }
        if (params.type === 'STYLE_TRANSFER') {
            return Promise.resolve({ error: 'Style Transfer is not yet available for the local backend.' });
        }
        if (params.type === 'VIDEO') {
            return Promise.resolve({ error: 'Video generation is not yet available for the local backend.' });
        }
        if (params.type === 'AUDIO') {
            return Promise.resolve({ error: 'Audio generation is not yet available for the local backend.' });
        }

        console.log("Generating with Ollama", params);
        return Promise.resolve({ text: "Generated by Ollama" });
    }

    private async blend(images: any[], faceRefImage: string | null, blendMode: string, technicalBlendMode: string, prompt: string, model: string, numberOfImages: number, aspectRatio: string): Promise<any> {
        const validImages = images.filter(img => img.src);
        const textParts = [`As an expert art director, analyze the provided images. Create a single, detailed, and vivid prompt for an AI image generator.`];
        if (faceRefImage) textParts.push(`The first image is a face reference; this person must be prominently featured in the final image.`);
        textParts.push(`The other images provide the scene, subjects, and style elements. Specific instructions for each image are as follows:`);

        validImages.forEach((img, index) => {
            let instructionText = `Image ${index + 1}`;
            const { transform, instruction } = img;
            if (transform.scale !== 1 || transform.x !== 0 || transform.y !== 0) {
                instructionText += ` (framed with a ${transform.scale.toFixed(1)}x zoom, positioned at x:${transform.x.toFixed(0)}, y:${transform.y.toFixed(0)})`;
            }
            if (instruction) {
                instructionText += `: "${instruction}"`;
            }
            textParts.push(instructionText);
        });

        textParts.push(`Creatively combine all these elements, interpreted through the artistic lens of '${blendMode}'.`);
        if (technicalBlendMode !== 'Normal') {
            textParts.push(`Apply a '${technicalBlendMode}' technical blend effect to harmonize the images.`);
        }
        if (prompt) textParts.push(`Weave in the user's specific guidance: '${prompt}'.`);
        textParts.push(`Your response must be ONLY the resulting creative prompt, ready to be used by an image generation model. Do not include any other text, conversation, or explanations.`);

        const imageInputs = [];
        if (faceRefImage) imageInputs.push(faceRefImage);
        imageInputs.push(...validImages.map(img => img.src as string));

        const imageParts = imageInputs.map(img => img.split(',')[1]);

        const visionResponse = await fetch(`${this.serverUrl}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llava',
                prompt: textParts.join(' '),
                images: imageParts,
                stream: false
            })
        });

        const visionResult = await visionResponse.json();
        const descriptivePrompt = visionResult.response;

        if (!descriptivePrompt) {
            return { error: 'Could not generate a descriptive prompt from the source images.' };
        }

        const imageResponse = await fetch(`${this.serverUrl}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'stable-diffusion',
                prompt: descriptivePrompt,
                stream: false
            })
        });

        const imageResult = await imageResponse.json();
        const newImage = `data:image/jpeg;base64,${imageResult.response}`;

        return { images: [newImage] };
    }

    private async inpaint(image: string, mask: string, prompt: string, creativity: number): Promise<any> {
        const creativityPrompt = `Apply this with ${creativity}% creativity, where 100% is maximum artistic freedom and 0% is a very literal interpretation.`;
        const fullPrompt = `You are a master digital artist specializing in photorealistic inpainting. Your task is to seamlessly edit an image based on a user's prompt and a mask. The first image is the source. The second image is the mask. You must edit the source image ONLY in the area indicated by the mask. Your edits should blend perfectly with the surrounding image, matching lighting, shadows, and texture. The user wants to: '${prompt}'. ${creativityPrompt}`;

        const imagePart = image.split(',')[1];
        const maskPart = mask.split(',')[1];

        const response = await fetch(`${this.serverUrl}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llava',
                prompt: fullPrompt,
                images: [imagePart, maskPart],
                stream: false
            })
        });

        const result = await response.json();
        const newImage = `data:image/jpeg;base64,${result.response}`;

        return { image: newImage };
    }

    private async enhancePrompt(prompt: string, context: string): Promise<any> {
        const fullPrompt = `You are an expert prompt engineer for generative AI. Your task is to take a user's idea and expand it into a rich, detailed, and evocative prompt. Your enhanced prompt should include specific keywords for style (e.g., 'cinematic lighting', 'impressionistic'), mood, and composition (e.g., 'low-angle shot', 'dutch angle'), and be structured for maximum impact. Return ONLY the enhanced prompt, without any conversational text or markdown.

        Context: The user wants to generate content for "${context}".

        User's Prompt: "${prompt}"`;

        const response = await fetch(`${this.serverUrl}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: this.model,
                prompt: fullPrompt
            })
        });

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error("Failed to read response from Ollama server.");
        }
        const decoder = new TextDecoder();
        let result = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line) {
                    const parsed = JSON.parse(line);
                    result += parsed.response;
                }
            }
        }
        return { text: result };
    }
}

export class GenerationService {
    private provider: GenerationProvider;

    constructor(backend: 'cloud' | 'local', apiKey: string, ollamaServerUrl?: string, localModel?: string) {
        if (backend === 'cloud') {
            this.provider = new GoogleAIProvider(apiKey);
        } else {
            if (!ollamaServerUrl || !localModel) {
                throw new Error("Ollama server URL and model are required for local backend.");
            }
            this.provider = new OllamaProvider(ollamaServerUrl, localModel);
        }
    }

    async generate(params: any): Promise<any> {
        return this.provider.generate(params);
    }
}