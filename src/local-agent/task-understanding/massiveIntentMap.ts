/**
 * MASSIVE Intent Taxonomy → Project Intent Mapping
 *
 * The MASSIVE dataset (Amazon SLURP localization) has 60 intents across 18 domains,
 * formatted as {scenario}_{intent}. This file maps them to our generic project ontology.
 *
 * Reference: https://github.com/alexa/massive
 *
 * Project intents: SEARCH, OPEN, BOOK, BUY, ORDER, RESERVE, CANCEL, FIND, SEND,
 *                  READ, FILL_FORM, DOWNLOAD, UPLOAD, COMPARE, NAVIGATE, CHECK,
 *                  SUBMIT, CONFIRM, EDIT, DELETE
 *
 * UNMAPPED intents (not safely representable in our ontology) → 'UNKNOWN'
 */

export interface MassiveMapping {
    projectIntent: string;
    /** Override the computed taskType (optional) */
    taskType?: string;
    /** Confidence multiplier (0–1); lower for ambiguous mappings */
    reliability: number;
    /** For debugging/display */
    massiveDomain: string;
}

export const MASSIVE_TO_PROJECT: Record<string, MassiveMapping> = {
    // ── ALARM ─────────────────────────────────────────────────────────
    'alarm_query':      { projectIntent: 'CHECK',  massiveDomain: 'alarm',  reliability: 0.85 },
    'alarm_remove':     { projectIntent: 'DELETE', massiveDomain: 'alarm',  reliability: 0.85 },
    'alarm_set':        { projectIntent: 'BOOK',   massiveDomain: 'alarm',  reliability: 0.75 },   // nearest: schedule/book

    // ── AUDIO ─────────────────────────────────────────────────────────
    'audio_volume_down':  { projectIntent: 'UNKNOWN', massiveDomain: 'audio', reliability: 0.0 },
    'audio_volume_mute':  { projectIntent: 'UNKNOWN', massiveDomain: 'audio', reliability: 0.0 },
    'audio_volume_other': { projectIntent: 'UNKNOWN', massiveDomain: 'audio', reliability: 0.0 },
    'audio_volume_up':    { projectIntent: 'UNKNOWN', massiveDomain: 'audio', reliability: 0.0 },

    // ── CALENDAR ──────────────────────────────────────────────────────
    'calendar_query':   { projectIntent: 'CHECK',  massiveDomain: 'calendar', reliability: 0.85 },
    'calendar_remove':  { projectIntent: 'CANCEL', massiveDomain: 'calendar', reliability: 0.85 },
    'calendar_set':     { projectIntent: 'BOOK',   massiveDomain: 'calendar', reliability: 0.75, taskType: 'BOOK_EVENT' },

    // ── COOKING ───────────────────────────────────────────────────────
    'cooking_query':    { projectIntent: 'SEARCH', massiveDomain: 'cooking', reliability: 0.80 },
    'cooking_recipe':   { projectIntent: 'FIND',   massiveDomain: 'cooking', reliability: 0.80 },

    // ── DATETIME ──────────────────────────────────────────────────────
    'datetime_convert': { projectIntent: 'CHECK',  massiveDomain: 'datetime', reliability: 0.75 },
    'datetime_query':   { projectIntent: 'CHECK',  massiveDomain: 'datetime', reliability: 0.80 },

    // ── EMAIL ─────────────────────────────────────────────────────────
    'email_addcontact':   { projectIntent: 'EDIT',   massiveDomain: 'email', reliability: 0.80 },
    'email_query':        { projectIntent: 'SEARCH', massiveDomain: 'email', reliability: 0.90, taskType: 'READ_EMAIL' },
    'email_querycontact': { projectIntent: 'FIND',   massiveDomain: 'email', reliability: 0.85 },
    'email_sendemail':    { projectIntent: 'SEND',   massiveDomain: 'email', reliability: 0.95, taskType: 'SEND_EMAIL' },

    // ── GENERAL ───────────────────────────────────────────────────────
    'general_greet':    { projectIntent: 'UNKNOWN', massiveDomain: 'general', reliability: 0.0 },
    'general_joke':     { projectIntent: 'UNKNOWN', massiveDomain: 'general', reliability: 0.0 },
    'general_quirky':   { projectIntent: 'UNKNOWN', massiveDomain: 'general', reliability: 0.0 },

    // ── IOT ───────────────────────────────────────────────────────────
    'iot_cleaning':         { projectIntent: 'UNKNOWN', massiveDomain: 'iot', reliability: 0.0 },
    'iot_coffee':           { projectIntent: 'UNKNOWN', massiveDomain: 'iot', reliability: 0.0 },
    'iot_hue_lightchange':  { projectIntent: 'UNKNOWN', massiveDomain: 'iot', reliability: 0.0 },
    'iot_hue_lightdim':     { projectIntent: 'UNKNOWN', massiveDomain: 'iot', reliability: 0.0 },
    'iot_hue_lightoff':     { projectIntent: 'UNKNOWN', massiveDomain: 'iot', reliability: 0.0 },
    'iot_hue_lighton':      { projectIntent: 'UNKNOWN', massiveDomain: 'iot', reliability: 0.0 },
    'iot_hue_lightup':      { projectIntent: 'UNKNOWN', massiveDomain: 'iot', reliability: 0.0 },
    'iot_wemo_off':         { projectIntent: 'UNKNOWN', massiveDomain: 'iot', reliability: 0.0 },
    'iot_wemo_on':          { projectIntent: 'UNKNOWN', massiveDomain: 'iot', reliability: 0.0 },

    // ── LISTS ─────────────────────────────────────────────────────────
    'lists_createoradd': { projectIntent: 'EDIT',   massiveDomain: 'lists', reliability: 0.75 },
    'lists_query':       { projectIntent: 'READ',   massiveDomain: 'lists', reliability: 0.80 },
    'lists_remove':      { projectIntent: 'DELETE', massiveDomain: 'lists', reliability: 0.80 },

    // ── MUSIC / PLAY ──────────────────────────────────────────────────
    'music_dislikeness': { projectIntent: 'UNKNOWN', massiveDomain: 'music', reliability: 0.0 },
    'music_likeness':    { projectIntent: 'UNKNOWN', massiveDomain: 'music', reliability: 0.0 },
    'music_query':       { projectIntent: 'SEARCH',  massiveDomain: 'music', reliability: 0.75 },
    'music_settings':    { projectIntent: 'EDIT',    massiveDomain: 'music', reliability: 0.60 },
    'play_audiobook':    { projectIntent: 'OPEN',    massiveDomain: 'music', reliability: 0.75 },
    'play_game':         { projectIntent: 'OPEN',    massiveDomain: 'music', reliability: 0.70 },
    'play_music':        { projectIntent: 'OPEN',    massiveDomain: 'music', reliability: 0.80 },
    'play_podcasts':     { projectIntent: 'OPEN',    massiveDomain: 'music', reliability: 0.75 },
    'play_radio':        { projectIntent: 'OPEN',    massiveDomain: 'music', reliability: 0.75 },

    // ── NEWS ──────────────────────────────────────────────────────────
    'news_query':        { projectIntent: 'SEARCH',  massiveDomain: 'news', reliability: 0.85 },

    // ── QA (Question Answering) ────────────────────────────────────────
    'qa_currency':       { projectIntent: 'CHECK',  massiveDomain: 'qa', reliability: 0.80 },
    'qa_definition':     { projectIntent: 'SEARCH', massiveDomain: 'qa', reliability: 0.80 },
    'qa_factoid':        { projectIntent: 'SEARCH', massiveDomain: 'qa', reliability: 0.80 },
    'qa_maths':          { projectIntent: 'CHECK',  massiveDomain: 'qa', reliability: 0.75 },
    'qa_stock':          { projectIntent: 'CHECK',  massiveDomain: 'qa', reliability: 0.85 },

    // ── RECOMMENDATION ────────────────────────────────────────────────
    'recommendation_events':    { projectIntent: 'FIND',   massiveDomain: 'recommendation', reliability: 0.80 },
    'recommendation_locations': { projectIntent: 'FIND',   massiveDomain: 'recommendation', reliability: 0.80 },
    'recommendation_movies':    { projectIntent: 'FIND',   massiveDomain: 'recommendation', reliability: 0.80 },

    // ── SOCIAL ────────────────────────────────────────────────────────
    'social_post':       { projectIntent: 'SEND',   massiveDomain: 'social', reliability: 0.80 },
    'social_query':      { projectIntent: 'SEARCH', massiveDomain: 'social', reliability: 0.75 },

    // ── TAKEAWAY / FOOD ───────────────────────────────────────────────
    'takeaway_order':    { projectIntent: 'ORDER',  massiveDomain: 'takeaway', reliability: 0.90, taskType: 'ORDER_FOOD' },
    'takeaway_query':    { projectIntent: 'SEARCH', massiveDomain: 'takeaway', reliability: 0.85 },

    // ── TRANSPORT ─────────────────────────────────────────────────────
    'transport_query':   { projectIntent: 'SEARCH', massiveDomain: 'transport', reliability: 0.85 },
    'transport_taxi':    { projectIntent: 'BOOK',   massiveDomain: 'transport', reliability: 0.90, taskType: 'BOOK_TAXI' },
    'transport_ticket':  { projectIntent: 'BOOK',   massiveDomain: 'transport', reliability: 0.90, taskType: 'BOOK_TRAVEL' },
    'transport_traffic': { projectIntent: 'CHECK',  massiveDomain: 'transport', reliability: 0.85 },

    // ── WEATHER ───────────────────────────────────────────────────────
    'weather_query':     { projectIntent: 'CHECK',  massiveDomain: 'weather', reliability: 0.90 },
};

/**
 * Map a MASSIVE model label to project intent + optional taskType override.
 * Returns UNKNOWN for unmapped or low-reliability labels.
 */
export function mapMassiveToProject(massiveLabel: string): MassiveMapping {
    const lower = massiveLabel.toLowerCase().trim();
    const mapping = MASSIVE_TO_PROJECT[lower];
    
    if (!mapping) {
        return { projectIntent: 'UNKNOWN', massiveDomain: 'unknown', reliability: 0.0 };
    }
    
    return mapping;
}

/**
 * Infer TASK_CATEGORY from a MASSIVE domain string, for use in slot extraction.
 */
export function inferCategoryFromMassiveDomain(domain: string): string {
    const map: Record<string, string> = {
        'email':          'COMMUNICATION',
        'social':         'COMMUNICATION',
        'transport':      'TRAVEL',
        'music':          'ENTERTAINMENT',
        'recommendation': 'ENTERTAINMENT',
        'takeaway':       'FOOD',
        'cooking':        'FOOD',
        'news':           'GENERAL',
        'qa':             'GENERAL',
        'datetime':       'GENERAL',
        'weather':        'GENERAL',
        'lists':          'PRODUCTIVITY',
        'calendar':       'PRODUCTIVITY',
        'alarm':          'PRODUCTIVITY',
        'iot':            'OTHER',
        'general':        'OTHER',
        'audio':          'OTHER',
    };
    return map[domain] ?? 'GENERAL';
}
