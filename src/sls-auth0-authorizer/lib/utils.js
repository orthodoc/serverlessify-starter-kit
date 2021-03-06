import { AuthenticationClient } from 'auth0';

export function getAuth0Client() {
  if (typeof process.env.AUTH0_DOMAIN === 'undefined' || !process.env.AUTH0_DOMAIN.match(/\.auth0\.com$/)) {
    throw new Error('Expected AUTH0_DOMAIN environment variable to be set. See https://manage.auth0.com/#/applications');
  }

  if (typeof process.env.AUTH0_CLIENT_ID === 'undefined' || process.env.AUTH0_CLIENT_ID.length === 0) {
    throw new Error('Expected AUTH0_CLIENT_ID environment variable to be set. See https://manage.auth0.com/#/applications');
  }

  return new AuthenticationClient({
    domain    : process.env.AUTH0_DOMAIN,
    clientId  : process.env.AUTH0_CLIENT_ID,
  });
}

const methodScopeRegEx = /^arn:aws:execute-api:(?:.+?):(?:.+?):(?:.+?)\/(?:.+?)\/(GET|PUT|HEAD|PATCH|POST|DELETE|OPTIONS)\/(.+?)\/(.+?)(?:$|\/)/;

// methodArn: 'arn:aws:execute-api:eu-west-1:143524343865:uu5kjavccg/dev/GET/user/999/param/333'
export function getMethodScope(arn) {
  const [, verb, _area, extra] = methodScopeRegEx.exec(arn) || [];
  const area = _area && _area.toLowerCase();
  return {
    verb,
    area,
    extra,
    isPublic: ['admin', 'user'].indexOf(area) < 0,
    isAdmin: area === 'admin',
    userId: area === 'user' && decodeURIComponent(extra),
  };
}

export function getBearerToken(event) {
  let token;

  if (!event.type || event.type !== 'TOKEN') {
    throw new Error('Expected `event.type` parameter to have value TOKEN');
  }

  var tokenString = event.authorizationToken;
  if (!tokenString) {
    throw new Error('Expected `event.authorizationToken` parameter to be set');
  }

  var match = tokenString.match(/^Bearer (.*)$/);
  if (! match || match.length < 2) {
    throw new Error('Invalid Authorization token');
  }

  return match[1];
}

export function getUserInfo(userInfo) {
  if (!userInfo || !userInfo.user_id) {
    throw new Error('No user_id returned from Auth0');
  }

  return {
    userId: userInfo.user_id,
    isAdmin: (
      userInfo.app_metadata &&
      userInfo.app_metadata.authorization &&
      userInfo.app_metadata.authorization.groups &&
      userInfo.app_metadata.authorization.groups.map(g => g.toLowerCase()).indexOf('admin') >= 0
    ),
  };
}

export function generatePolicyDocument(principalId, effect, resource) {
  var authResponse = {};
  authResponse.principalId = principalId;
  if (effect && resource) {
    var policyDocument = {};
    policyDocument.Version = '2012-10-17'; // default version
    policyDocument.Statement = [];
    var statementOne = {};
    statementOne.Action = 'execute-api:Invoke'; // default action
    statementOne.Effect = effect;
    statementOne.Resource = resource;
    policyDocument.Statement[0] = statementOne;
    authResponse.policyDocument = policyDocument;
  }
  console.log(`[auth0-authorizer] ${effect} access for ${principalId} to ${resource}`);
  return authResponse;
}

export const generateAuthorizer = ({ resource, onlyUserId, isPublic }) => ({ userId, isAdmin }) => generatePolicyDocument(
  userId,
  (isPublic || isAdmin || userId === onlyUserId) ? 'Allow' : 'Deny',
  resource
);
