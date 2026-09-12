import ActivityKit
import ExpoModulesCore

public class DartLiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DartLiveActivity")

    Function("areActivitiesEnabled") { () -> Bool in
      if #available(iOS 16.2, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      return false
    }

    AsyncFunction("isRunning") { () -> Bool in
      if #available(iOS 16.2, *) {
        return !Activity<DARTRideAttributes>.activities.isEmpty
      }
      return false
    }.runOnQueue(.main)

    AsyncFunction("start") { (payload: [String: Any]) async throws -> String? in
      guard #available(iOS 16.2, *) else {
        throw Exception(name: "UNSUPPORTED", description: "Live Activities need iOS 16.2+")
      }
      let auth = ActivityAuthorizationInfo()
      guard auth.areActivitiesEnabled else {
        throw Exception(name: "DISABLED", description: "Turn on Live Activities for DART in Settings → DART → Live Activities.")
      }
      let state = Self.state(from: payload)
      let studentId = (payload["studentId"] as? String) ?? ""
      if let existing = Activity<DARTRideAttributes>.activities.first {
        await existing.update(ActivityContent(state: state, staleDate: Date().addingTimeInterval(20 * 60)))
        return existing.id
      }
      let attrs = DARTRideAttributes(studentId: studentId)
      let content = ActivityContent(state: state, staleDate: Date().addingTimeInterval(20 * 60))
      let activity = try Activity.request(attributes: attrs, content: content, pushType: nil)
      return activity.id
    }.runOnQueue(.main)

    AsyncFunction("update") { (payload: [String: Any]) async throws in
      guard #available(iOS 16.2, *) else { return }
      let state = Self.state(from: payload)
      for activity in Activity<DARTRideAttributes>.activities {
        await activity.update(ActivityContent(state: state, staleDate: Date().addingTimeInterval(20 * 60)))
      }
    }.runOnQueue(.main)

    AsyncFunction("end") { (payload: [String: Any]?) async throws in
      guard #available(iOS 16.2, *) else { return }
      let finalState = payload.map { Self.state(from: $0) }
      for activity in Activity<DARTRideAttributes>.activities {
        if let finalState {
          await activity.end(
            ActivityContent(state: finalState, staleDate: nil),
            dismissalPolicy: .after(Date().addingTimeInterval(8))
          )
        } else {
          await activity.end(nil, dismissalPolicy: .immediate)
        }
      }
    }.runOnQueue(.main)
  }

  @available(iOS 16.2, *)
  private static func state(from payload: [String: Any]) -> DARTRideAttributes.ContentState {
    DARTRideAttributes.ContentState(
      riderName: (payload["riderName"] as? String) ?? "Rider",
      routeCode: (payload["routeCode"] as? String) ?? "Bus",
      stopName: (payload["stopName"] as? String) ?? "Your stop",
      schoolName: (payload["schoolName"] as? String) ?? "",
      etaClock: (payload["etaClock"] as? String) ?? "—",
      etaPeriod: (payload["etaPeriod"] as? String) ?? "",
      delayLabel: (payload["delayLabel"] as? String) ?? "On time",
      late: (payload["late"] as? Bool) ?? false,
      progress: (payload["progress"] as? Double) ?? (payload["progress"] as? NSNumber)?.doubleValue ?? 0.12,
      statusLine: (payload["statusLine"] as? String) ?? "On the way",
      stopsAway: (payload["stopsAway"] as? Int) ?? (payload["stopsAway"] as? NSNumber)?.intValue ?? 0,
      minutes: (payload["minutes"] as? Int) ?? (payload["minutes"] as? NSNumber)?.intValue ?? 0
    )
  }
}
