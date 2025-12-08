/**
 * Interaction type utilities
 */

// Interaction type constants
export const INTERACTION_TYPES = {
	LAWSUIT: 'lawsuit',
	GRANT: 'grant',
	DEAL: 'deal'
};

/**
 * Gets the interaction type from a row
 * @param {any} interaction - Interaction value
 * @returns {string} Normalized interaction type
 */
export function getInteractionType(interaction) {
	const interactionStr = String(interaction || '').trim().toLowerCase();
	if (interactionStr === INTERACTION_TYPES.LAWSUIT) return INTERACTION_TYPES.LAWSUIT;
	if (interactionStr === INTERACTION_TYPES.GRANT) return INTERACTION_TYPES.GRANT;
	return INTERACTION_TYPES.DEAL;
}

