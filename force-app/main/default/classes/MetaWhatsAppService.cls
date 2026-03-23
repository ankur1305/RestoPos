/**
 * Meta WhatsApp Cloud API: send receipt as a template message after billing.
 *
 * Setup: Remote Site Meta_Graph_API, WhatsApp_Config__mdt Default, WhatsApp_API_Config__c token + enabled.
 *
 * The approved template in WhatsApp Manager must use a DOCUMENT header (PDF uploaded via /media) and a body
 * with one text variable {{1}} filled with the restaurant name.
 */
public without sharing class MetaWhatsAppService {
    public static final String GRAPH_VERSION = 'v21.0';

    public class MetaWhatsAppException extends Exception {
    }

    /**
     * @param toDigitsLocal 10-digit local number (no country code)
     */
    public static void sendReceiptPdf(
        String toDigitsLocal,
        Blob pdfBlob,
        String restaurantName,
        String pdfFileName
    ) {
        if (pdfBlob == null || pdfBlob.size() == 0) {
            throw new MetaWhatsAppException('PDF is empty.');
        }

        WhatsApp_API_Config__c hs = getApiConfig();
        if (hs == null || !hs.Is_Enabled__c || String.isBlank(hs.Access_Token__c)) {
            throw new MetaWhatsAppException('WhatsApp API is not configured or disabled.');
        }

        WhatsApp_Config__mdt cfg = getActiveConfig();
        if (cfg == null) {
            throw new MetaWhatsAppException('WhatsApp_Config__mdt Default is missing.');
        }
        if (!cfg.Active__c || String.isBlank(cfg.Phone_Number_Id__c)) {
            throw new MetaWhatsAppException('WhatsApp config is inactive or Phone Number Id is blank.');
        }

        String e164 = toE164(toDigitsLocal, cfg.Country_Prefix__c);
        String token = hs.Access_Token__c.trim();

        String mediaId = uploadMedia(cfg.Phone_Number_Id__c, token, pdfBlob, pdfFileName);
        sendReceiptTemplateMessage(cfg.Phone_Number_Id__c, token, e164, cfg, mediaId, restaurantName, pdfFileName);
    }

    public static Boolean isTenDigitPhone(String phone) {
        return String.isNotBlank(phone) && phone.length() == 10 && Pattern.matches('^[0-9]{10}$', phone);
    }

    @TestVisible
    private static Blob buildMultipartPdfForTest(Blob pdfBody, String filename, String boundary) {
        return buildMultipartPdf(pdfBody, filename, boundary);
    }

    private static WhatsApp_API_Config__c getApiConfig() {
        List<WhatsApp_API_Config__c> rows = [
            SELECT Access_Token__c, Is_Enabled__c
            FROM WhatsApp_API_Config__c
            ORDER BY CreatedDate ASC
            LIMIT 1
        ];
        return rows.isEmpty() ? null : rows[0];
    }

    private static WhatsApp_Config__mdt getActiveConfig() {
        List<WhatsApp_Config__mdt> rows = [
            SELECT
                Phone_Number_Id__c,
                Template_Name__c,
                Template_Language__c,
                Country_Prefix__c,
                Active__c
            FROM WhatsApp_Config__mdt
            WHERE DeveloperName = 'Default'
            LIMIT 1
        ];
        return rows.isEmpty() ? null : rows[0];
    }

    private static String toE164(String local10, String countryPrefix) {
        String p = String.isBlank(countryPrefix) ? '91' : countryPrefix.replaceAll('[^0-9]', '');
        return p + local10;
    }

    private static String uploadMedia(String phoneNumberId, String token, Blob fileBody, String filename) {
        String boundary = '----sfdcFormBoundary' + String.valueOf(Math.abs(Crypto.getRandomInteger()));
        Blob bodyBlob = buildMultipartPdf(fileBody, filename, boundary);

        HttpRequest req = new HttpRequest();
        req.setMethod('POST');
        req.setEndpoint('https://graph.facebook.com/' + GRAPH_VERSION + '/' + phoneNumberId + '/media');
        req.setHeader('Authorization', 'Bearer ' + token);
        req.setHeader('Content-Type', 'multipart/form-data; boundary=' + boundary);
        req.setBodyAsBlob(bodyBlob);
        req.setTimeout(120000);

        HttpResponse res = new Http().send(req);
        if (res.getStatusCode() < 200 || res.getStatusCode() >= 300) {
            throw new MetaWhatsAppException(
                'Media upload failed: ' + res.getStatusCode() + ' ' + res.getBody()
            );
        }
        Map<String, Object> parsed = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
        String id = (String) parsed.get('id');
        if (String.isBlank(id)) {
            throw new MetaWhatsAppException('Media upload missing id: ' + res.getBody());
        }
        return id;
    }

    private static void sendReceiptTemplateMessage(
        String phoneNumberId,
        String token,
        String toE164,
        WhatsApp_Config__mdt cfg,
        String mediaId,
        String restaurantName,
        String pdfFileName
    ) {
        String tplName = String.isNotBlank(cfg.Template_Name__c) ? cfg.Template_Name__c.trim() : 'receipt_pdf';
        String lang = String.isNotBlank(cfg.Template_Language__c) ? cfg.Template_Language__c.trim() : 'en_US';

        Map<String, Object> headerParam = new Map<String, Object>{
            'type' => 'document',
            'document' => new Map<String, Object>{ 'id' => mediaId, 'filename' => pdfFileName }
        };
        Map<String, Object> headerComp = new Map<String, Object>{
            'type' => 'header',
            'parameters' => new List<Object>{ headerParam }
        };
        Map<String, Object> bodyParam1 = new Map<String, Object>{
            'type' => 'text',
            'text' => String.isBlank(restaurantName) ? 'Restaurant' : restaurantName
        };
        Map<String, Object> bodyComp = new Map<String, Object>{
            'type' => 'body',
            'parameters' => new List<Object>{ bodyParam1 }
        };

        Map<String, Object> template = new Map<String, Object>{
            'name' => tplName,
            'language' => new Map<String, Object>{ 'code' => lang },
            'components' => new List<Object>{ headerComp, bodyComp }
        };

        postTemplateMessage(phoneNumberId, token, toE164, template);
    }

    private static void postTemplateMessage(
        String phoneNumberId,
        String token,
        String toE164,
        Map<String, Object> template
    ) {
        Map<String, Object> payload = new Map<String, Object>{
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => toE164,
            'type' => 'template',
            'template' => template
        };

        HttpRequest req = new HttpRequest();
        req.setMethod('POST');
        req.setEndpoint('https://graph.facebook.com/' + GRAPH_VERSION + '/' + phoneNumberId + '/messages');
        req.setHeader('Authorization', 'Bearer ' + token);
        req.setHeader('Content-Type', 'application/json');
        req.setBody(JSON.serialize(payload));
        req.setTimeout(120000);

        HttpResponse res = new Http().send(req);
        if (res.getStatusCode() < 200 || res.getStatusCode() >= 300) {
            throw new MetaWhatsAppException(
                'Send template failed: ' + res.getStatusCode() + ' ' + res.getBody()
            );
        }
    }

    private static Blob buildMultipartPdf(Blob pdfBody, String filename, String boundary) {
        String safeName = filename.replace('"', '_');
        String crlf = '\r\n';
        String part1 =
            '--' +
            boundary +
            crlf +
            'Content-Disposition: form-data; name="messaging_product"' +
            crlf +
            crlf +
            'whatsapp' +
            crlf;
        // Meta requires a separate "type" field for /media uploads (see Cloud API upload media).
        String partType =
            '--' +
            boundary +
            crlf +
            'Content-Disposition: form-data; name="type"' +
            crlf +
            crlf +
            'document' +
            crlf;
        String partFileHeader =
            '--' +
            boundary +
            crlf +
            'Content-Disposition: form-data; name="file"; filename="' +
            safeName +
            '"' +
            crlf +
            'Content-Type: application/pdf' +
            crlf +
            crlf;
        String partEnd = crlf + '--' + boundary + '--';
        return concatBlobs(
            new List<Blob>{
                Blob.valueOf(part1),
                Blob.valueOf(partType),
                Blob.valueOf(partFileHeader),
                pdfBody,
                Blob.valueOf(partEnd)
            }
        );
    }

    /**
     * Concatenate blobs preserving binary bytes. Concatenating Base64 strings and decoding once corrupts PDFs
     * and breaks multipart parsing (Graph returns "file is required").
     */
    private static Blob concatBlobs(List<Blob> parts) {
        if (parts == null || parts.isEmpty()) {
            return Blob.valueOf('');
        }
        String hexAgg = '';
        for (Blob b : parts) {
            if (b != null && b.size() > 0) {
                hexAgg += EncodingUtil.convertToHex(b);
            }
        }
        if (String.isBlank(hexAgg)) {
            return Blob.valueOf('');
        }
        return EncodingUtil.convertFromHex(hexAgg);
    }
}
