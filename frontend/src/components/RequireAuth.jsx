import { Navigate, useLocation } from "react-router-dom";

export default function RequireAuth({ user, children, allowedRoles }) {
  const location = useLocation();

  // Check if user is logged in
  if (!user) {
    return (<Navigate to="/login" replace state={{ from: location.pathname }} />
    );
  }

  // check if user's role is permitted for a route
  // if the user's role is not permitted redirect back to the main page
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
