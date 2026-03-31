public class PermissionUtils {

    public static Boolean isGuestContext() {
        return UserInfo.getUserType() == 'Guest';
    }

    public static void ensureReadable(Schema.DescribeSObjectResult describeResult, String label) {
        if (isGuestContext()) {
            return;
        }
        if (!describeResult.isAccessible()) {
            throw new AuraHandledException(label + ' are not readable for this user.');
        }
    }

    public static void ensureUpdatable(Schema.DescribeSObjectResult describeResult, String label) {
        if (isGuestContext()) {
            return;
        }
        if (!describeResult.isUpdateable()) {
            throw new AuraHandledException(label + ' are not updateable for this user.');
        }
    }

    public static void ensureCreateOrUpdate(String idValue, Schema.DescribeSObjectResult describeResult, String label) {
        if (isGuestContext()) {
            return;
        }
        if (String.isBlank(idValue)) {
            if (!describeResult.isCreateable()) {
                throw new AuraHandledException('No create permission for ' + label + '.');
            }
        } else if (!describeResult.isUpdateable()) {
            throw new AuraHandledException('No update permission for ' + label + '.');
        }
    }

    public static void ensureDeletable(Schema.DescribeSObjectResult describeResult, String label) {
        if (isGuestContext()) {
            return;
        }
        if (!describeResult.isDeletable()) {
            throw new AuraHandledException('No delete permission for ' + label + '.');
        }
    }
}
