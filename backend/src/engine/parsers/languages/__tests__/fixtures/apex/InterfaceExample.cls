public interface IAccountService {
    List<Account> getAccounts();
    void saveAccount(Account acc);
    void deleteAccount(Id accountId);
}
