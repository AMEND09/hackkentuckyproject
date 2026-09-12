import ActivityKit
import Foundation

/// Must stay identical to `targets/widget/DARTRideAttributes.swift`.
struct DARTRideAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var riderName: String
    var routeCode: String
    var stopName: String
    var schoolName: String
    var etaClock: String
    var etaPeriod: String
    var delayLabel: String
    var late: Bool
    var progress: Double
    var statusLine: String
    var stopsAway: Int
    var minutes: Int
  }

  var studentId: String
}
