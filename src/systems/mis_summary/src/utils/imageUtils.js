/**
 * Detects Google Drive image URLs and converts them to high-performance thumbnails.
 * Handles various patterns including export links, direct file links, and raw IDs.
 * 
 * @param {string} url - The raw image URL or Drive ID
 * @returns {string|null} - The displayable thumbnail URL or original URL
 */
export const getDisplayableImageUrl = (url) => {
    if (!url) return null;
    if (typeof url !== 'string') return url;

    const trimmedUrl = url.trim();

    try {
        // 1. If it's a direct Drive ID (28-35 chars, no slashes/dots)
        if (/^[a-zA-Z0-9_-]{28,35}$/.test(trimmedUrl)) {
            return `https://drive.google.com/thumbnail?id=${trimmedUrl}&sz=w150`;
        }

        // 2. Extract ID from various Google Drive URL formats
        let driveId = null;
        const ucExportMatch = trimmedUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        const directMatch = trimmedUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        const openMatch = trimmedUrl.match(/open\?id=([a-zA-Z0-9_-]+)/);

        if (directMatch) driveId = directMatch[1];
        else if (openMatch) driveId = openMatch[1];
        else if (ucExportMatch && (trimmedUrl.includes("drive.google.com") || trimmedUrl.includes("docs.google.com"))) {
            driveId = ucExportMatch[1];
        }

        if (driveId) {
            return `https://drive.google.com/thumbnail?id=${driveId}&sz=w150`;
        }

        // 3. Fallback for Google Drive links that don't match strict patterns but contain an ID
        if (trimmedUrl.includes("drive.google.com") || trimmedUrl.includes("docs.google.com")) {
            const anyIdMatch = trimmedUrl.match(/([a-zA-Z0-9_-]{25,})/);
            if (anyIdMatch && anyIdMatch[1]) {
                return `https://drive.google.com/thumbnail?id=${anyIdMatch[1]}&sz=w150`;
            }
        }

        // 4. If it's already a thumbnail or a direct image link, return as is
        return trimmedUrl;
    } catch (e) {
        console.error("Error processing image URL:", url, e);
        return trimmedUrl;
    }
};
