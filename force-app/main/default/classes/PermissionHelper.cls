public class PermissionHelper {

    public static void grantAdminFLS() {
        Profile adminProfile = [SELECT Id FROM Profile WHERE Name = 'System Administrator' LIMIT 1];
        PermissionSet ps = [SELECT Id FROM PermissionSet WHERE ProfileId = :adminProfile.Id LIMIT 1];

        List<String> objects = new List<String>{
            'Restaurant__c','Restaurant_Table__c','Menu_Category__c',
            'Menu_Item__c','POS_Order__c','Order_Item__c','Receipt__c'
        };

        Set<String> existingFields = new Set<String>();
        for (FieldPermissions fp : [SELECT Field FROM FieldPermissions WHERE ParentId = :ps.Id AND SObjectType IN :objects]) {
            existingFields.add(fp.Field);
        }

        List<FieldPermissions> toInsert = new List<FieldPermissions>();

        for (String obj : objects) {
            Map<String, Schema.SObjectField> fieldMap = Schema.getGlobalDescribe().get(obj).getDescribe().fields.getMap();
            for (String fieldName : fieldMap.keySet()) {
                if (!fieldName.endsWith('__c')) continue;
                Schema.DescribeFieldResult dfr = fieldMap.get(fieldName).getDescribe();
                if (dfr.isCalculated() || !dfr.isPermissionable()) continue;

                String fieldKey = obj + '.' + dfr.getName();
                if (existingFields.contains(fieldKey)) continue;

                toInsert.add(new FieldPermissions(
                    ParentId = ps.Id,
                    SObjectType = obj,
                    Field = fieldKey,
                    PermissionsRead = true,
                    PermissionsEdit = true
                ));
            }
        }

        if (!toInsert.isEmpty()) {
            insert toInsert;
            System.debug('Granted FLS on ' + toInsert.size() + ' fields');
            for (FieldPermissions fp : toInsert) {
                System.debug('  -> ' + fp.Field);
            }
        } else {
            System.debug('All field permissions already set');
        }
    }
}
