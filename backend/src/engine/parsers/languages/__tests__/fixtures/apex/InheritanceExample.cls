public with sharing class AccountServiceImpl extends BaseService implements IAccountService, Comparable {
    public override List<Account> getAccounts() {
        return [SELECT Id, Name FROM Account];
    }

    public void saveAccount(Account acc) {
        upsert acc;
    }

    public void deleteAccount(Id accountId) {
        Account acc = [SELECT Id FROM Account WHERE Id = :accountId];
        delete acc;
    }

    public Integer compareTo(Object other) {
        return 0;
    }
}
