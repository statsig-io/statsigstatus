#### 4/12/2022 22:00hrs PT

We are unable to allocate VMs to run Databricks jobs. This will cause all analytics to be delayed. We have identified the root-cause to be a bug on Azure Billing side and have engaged with the Azure support team to resolve this as soon as possible.

4/13/2022

15:30hrs PT Still working with Azure on resolution. We are running a pared down data pipeline to unblock everyone, while in parallel we figure out a full solution.

20:00hrs PT The Azure issues have been resolved. Analytics are being processed and are catching back up. Incident impact was limited to processing delays; no data was lost.

#### 4/07/2022 10:00hrs PT

Fixed

An outage on Azure's Events Hub has impacted real time event streaming in Statsig, and outgoing integrations which replay events.

We're actively monitoring the issue and attempting to replay missing integration data.

12:00 All services back to normal

#### 2/28/2022 12:46hrs PT

Mitigated/Fixed

12:25 Offending change pushed to EU region;

12:40 Offending change pushed to SEA region;

12:46 Reports of iOS clients using anything below v1.8.0 of the iOS SDK were crashing

13:05 Issue identified; started to revert recent changes;

13:36 Changes reverted and issue mitigated. All services functioning normally.

---

Root Cause:

The iOS SDK saves the response from Statsig's `initialize` endpoint to `UserDefaults` to be used to serve feature gate and experiment values when the user or Statsig is offline. Prior to v1.8.0, this was done via the [`UserDefaults.standard.setValue`](https://github.com/statsig-io/ios-sdk/blob/v1.7.3/Sources/Statsig/InternalStore.swift#L77) API. The problem with using this API is that it will crash if the value is a dictionary with any `nil` value in it.

We discovered the issue a couple weeks ago and fixed it in v1.8.1+ [here](https://github.com/statsig-io/ios-sdk/blob/v1.8.1/Sources/Statsig/InternalStore.swift#L95) by JSON serializing the payload first before saving to `UserDefaults`.

Starting in v1.8.0, the SDK started only extracting fields explicitly and saving only those select fields into `UserDefaults`.

Combined, these changes mean that adding new fields to the endpoint response, or returning nil for any existing field in the response, will not cause the SDK to crash in the future.  

Today we deployed a change that introduced some new fields to the `initialize` endpoint's response, which are not used by the current versions of the SDK. However, one field has `nil` in the value, which resulted in crashes for versions below v1.8.0.

Mitigation:

We rolled back the changes to the `initialize` endpoint as soon as we discovered the issue, and since then crashes have stopped.

Prevention:

- v1.8.1+ of the iOS SDK contains the proper protections for similar potential issues
- We have verified that the Android SDK already had these protections in place.  As always, we recommend staying up to date with the most recent version of Statsig SDKs (4.3.0 for Android)
- we are updating the `initialize` endpoint to not return any `nil` before we deploy the change again
- we are working on adding tests to ensure `nil` will not be included in the endpoint's response.

---

#### 2/24/2022 11:10hrs PT

Mitigated/Fixed

11:10 Elevated rates of console and API errors related to a caching change.

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
