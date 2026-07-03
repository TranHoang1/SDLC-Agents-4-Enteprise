public class AccountService {
    private String name;
    private static final Integer MAX_RETRIES = 3;

    public AccountService() {
        this.name = 'default';
    }

    public List<Account> getAccounts(String filter) {
        return [SELECT Id, Name FROM Account WHERE Name LIKE :filter];
    }

    @AuraEnabled
    public static void updateAccount(Account acc) {
        update acc;
    }

    private Integer calculateScore(Integer base, Integer bonus) {
        if (base > 100) {
            return base + bonus * 2;
        }
        return base + bonus;
    }
}
