#### 2/24/2022, 42 minutes

Mitigated/Fixed

11:10 Elevated rates of console and API errors related to a caching change

11:52 Resolved.  All services functioning normally.

---

#### 2/16/2022, 12:20hrs PT

Mitigated/Fixed

13:01
We are aware of slow response times on our API pods.  We believe we have identified the underlying issue and are actively working on mitigating it.

13:56
We have mitigated the issue and are spinning back the clusters back up.  Services should start to come back online soon.

14:25
All services are back up and performing as expected.  

15:26
We are working on identifying all affected customers and will be informing them in the next hour or so.

---

#### 2/5/2022, 18:00hrs PT

Mitigated/Fixed

We received reports of www and console not loading on Safari. Chrome worked fine. A refresh assisted by typeahead usually fixed the issue.

Upon investigation we identified this is because of http -> https redirect that was broken when we moved from Kubernetes Ingress to Istio Gateway. The issue was resolved at 9AM on 2/6/2022.
