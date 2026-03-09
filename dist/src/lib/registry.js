export function inferCompatibilityDefinition(channel, channelConfig) {
    const accounts = channelConfig?.accounts;
    const firstAccount = accounts ? Object.values(accounts)[0] : undefined;
    if (!firstAccount) {
        return undefined;
    }
    const inferredFields = Object.keys(firstAccount);
    return {
        channel,
        requiredFields: inferredFields,
        optionalFields: [],
        supportsAccounts: true,
        defaults: {},
        compatibilityMode: true,
        source: "compatibility"
    };
}
export function createRequestDefinition(channel, fieldSet) {
    return {
        channel,
        requiredFields: [...fieldSet.requiredFields],
        optionalFields: [...(fieldSet.optionalFields ?? [])],
        supportsAccounts: true,
        defaults: {},
        compatibilityMode: false,
        source: "request"
    };
}
export function resolveChannelDefinition(channel, currentConfig, fieldSet) {
    if (fieldSet) {
        return createRequestDefinition(channel, fieldSet);
    }
    return inferCompatibilityDefinition(channel, currentConfig.channels?.[channel]);
}
