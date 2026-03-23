@IsTest
private class MetaWhatsAppServiceTest {

    @IsTest
    static void isTenDigitPhone_validates() {
        System.assertEquals(true, MetaWhatsAppService.isTenDigitPhone('9876543210'));
        System.assertEquals(false, MetaWhatsAppService.isTenDigitPhone('987654321'));
        System.assertEquals(false, MetaWhatsAppService.isTenDigitPhone(''));
        System.assertEquals(false, MetaWhatsAppService.isTenDigitPhone(null));
        System.assertEquals(false, MetaWhatsAppService.isTenDigitPhone('abcdefghij'));
    }

    @IsTest
    static void buildMultipartPdf_wrapsPdf() {
        Blob pdf = Blob.valueOf('%PDF-test');
        Blob multipart = MetaWhatsAppService.buildMultipartPdfForTest(pdf, 'receipt.pdf', 'testBoundary');
        System.assertNotEquals(null, multipart);
        System.assert(multipart.size() > pdf.size());
    }
}
