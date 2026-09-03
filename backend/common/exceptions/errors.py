from rest_framework.exceptions import APIException


class RouteWiseError(APIException):
    status_code = 400
    default_code = "BAD_REQUEST"
    default_detail = "Request could not be processed."

    def __init__(self, message=None, code=None, details=None, status_code=None):
        self.status_code = status_code or self.status_code
        self.default_code = code or self.default_code
        self.details = details or {}
        super().__init__(detail=message or self.default_detail, code=self.default_code)


class InfeasibleRouteError(RouteWiseError):
    status_code = 422
    default_code = "ROUTE_PLAN_INFEASIBLE"
    default_detail = "A feasible route plan could not be generated."
