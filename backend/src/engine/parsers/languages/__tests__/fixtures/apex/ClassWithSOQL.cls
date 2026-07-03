public class OpportunityService {
    public List<Opportunity> getOpenOpps() {
        return [SELECT Id, Name, Amount, StageName FROM Opportunity WHERE IsClosed = false];
    }

    public List<Account> getAccountsWithContacts() {
        return [SELECT Id, Name, (SELECT Id, FirstName, LastName FROM Contacts) FROM Account];
    }
}
