public without sharing class RestoPosController {

    @AuraEnabled
    public static Restaurant__c getRestaurantByCode(String code) {
        List<Restaurant__c> restaurants = [
            SELECT Id, Name, Code__c, Address__c, Phone__c,
                   Tax_Rate__c, Currency_Code__c, Is_Active__c, Logo_URL__c
            FROM Restaurant__c
            WHERE Code__c = :code AND Is_Active__c = true
            LIMIT 1
        ];
        if (restaurants.isEmpty()) {
            throw new AuraHandledException('Restaurant not found or inactive.');
        }
        Restaurant__c restaurant = restaurants[0];

        // Prefer Salesforce File attached to Restaurant record as logo source.
        String attachmentLogoUrl = getLatestRestaurantLogoUrl(restaurant.Id);
        if (String.isNotBlank(attachmentLogoUrl)) {
            restaurant.Logo_URL__c = attachmentLogoUrl;
        }
        return restaurant;
    }

    @AuraEnabled
    public static Boolean verifyPin(String restaurantId, String pin) {
        List<Restaurant__c> restaurants = [
            SELECT PIN__c FROM Restaurant__c
            WHERE Id = :restaurantId
            LIMIT 1
        ];
        if (restaurants.isEmpty()) {
            throw new AuraHandledException('Restaurant not found.');
        }
        return restaurants[0].PIN__c == pin;
    }

    private static String getLatestRestaurantLogoUrl(Id restaurantId) {
        try {
            List<ContentDocumentLink> links = [
                SELECT ContentDocumentId, ContentDocument.LatestPublishedVersionId
                FROM ContentDocumentLink
                WHERE LinkedEntityId = :restaurantId
                ORDER BY SystemModstamp DESC
                LIMIT 1
            ];
            if (links.isEmpty()) {
                return null;
            }
            Id documentId = links[0].ContentDocumentId;
            Id versionId = links[0].ContentDocument.LatestPublishedVersionId;
            if (documentId == null || versionId == null) {
                return null;
            }

            // Use a public distribution URL so logo works in Experience Cloud site UI.
            List<ContentDistribution> distributions = [
                SELECT ContentDownloadUrl
                FROM ContentDistribution
                WHERE ContentDocumentId = :documentId
                ORDER BY LastModifiedDate DESC
                LIMIT 1
            ];
            if (!distributions.isEmpty() && String.isNotBlank(distributions[0].ContentDownloadUrl)) {
                return distributions[0].ContentDownloadUrl;
            }

            // Create a public distribution once when missing so logo renders on Experience site.
            ContentDistribution dist = new ContentDistribution(
                Name = 'Restaurant Logo ' + String.valueOf(restaurantId),
                ContentVersionId = versionId,
                PreferencesAllowViewInBrowser = true,
                PreferencesLinkLatestVersion = true,
                PreferencesNotifyOnVisit = false
            );
            insert dist;

            ContentDistribution created = [
                SELECT ContentDownloadUrl
                FROM ContentDistribution
                WHERE Id = :dist.Id
                LIMIT 1
            ];
            if (String.isNotBlank(created.ContentDownloadUrl)) {
                return created.ContentDownloadUrl;
            }
            return '/sfc/servlet.shepherd/version/download/' + String.valueOf(versionId);
        } catch (Exception ex) {
            // Keep login resilient if Files visibility differs by profile/site user.
            return null;
        }
    }
}
