var SUPABASE_URL='https://lpjdurwfiidrztinjzyn.supabase.co';
var SUPABASE_ANON_KEY='sb_publishable_C88ixlj-EhwMHCxf3hmHuA_XmKsJthQ';
var sb=supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);

var currentUser=null;
var currentOrgId=null;
var currentOrgName=null;
var currentOrgSubStatus=null;
var currentOrgTrialEndsAt=null;

var authMode='login';

function showAuthError(msg){
  var el=document.getElementById('auth-error');
  el.textContent=msg;
  el.style.display='block';
}
function clearAuthError(){
  var el=document.getElementById('auth-error');
  el.style.display='none';
  el.textContent='';
}

function switchAuthMode(mode){
  authMode=mode;
  clearAuthError();
  document.getElementById('auth-login-mode').style.display=(mode==='login')?'':'none';
  document.getElementById('auth-signup-mode').style.display=(mode==='signup')?'':'none';
}

function setAuthBusy(busy){
  document.querySelectorAll('#auth-card button').forEach(function(b){b.disabled=busy;});
}

async function handleSignup(){
  clearAuthError();
  var storeName=document.getElementById('auth-store-name').value.trim();
  var email=document.getElementById('auth-signup-email').value.trim();
  var password=document.getElementById('auth-signup-password').value;

  if(!storeName||!email||!password){ showAuthError('All fields are required.'); return; }
  if(password.length<6){ showAuthError('Password must be at least 6 characters.'); return; }

  setAuthBusy(true);
  var {data,error}=await sb.auth.signUp({email:email,password:password});
  if(error){ setAuthBusy(false); showAuthError(error.message); return; }

  if(!data.session){
    setAuthBusy(false);
    showAuthError('Check your email to confirm your account, then sign in.');
    switchAuthMode('login');
    return;
  }

  currentUser=data.user;
  var {data:newOrgId,error:orgErr}=await sb.rpc('create_org_for_new_user',{org_name:storeName});
  setAuthBusy(false);
  if(orgErr){ showAuthError('Account created but store setup failed: '+orgErr.message); return; }
  currentOrgId=newOrgId;
  await resolveOrgAndEnterApp();
}

async function handleLogin(){
  clearAuthError();
  var email=document.getElementById('auth-email').value.trim();
  var password=document.getElementById('auth-password').value;
  if(!email||!password){ showAuthError('Email and password are required.'); return; }

  setAuthBusy(true);
  var {data,error}=await sb.auth.signInWithPassword({email:email,password:password});
  setAuthBusy(false);
  if(error){ showAuthError(error.message); return; }

  currentUser=data.user;
  await resolveOrgAndEnterApp();
}

async function handleLogout(){
  await sb.auth.signOut();
  currentUser=null;
  currentOrgId=null;
  currentOrgName=null;
  currentOrgSubStatus=null;
  currentOrgTrialEndsAt=null;
  document.getElementById('app-shell').style.display='none';
  document.getElementById('trial-gate-screen').style.display='none';
  resetBranding();
  document.getElementById('auth-screen').style.display='';
  switchAuthMode('login');
}

async function resolveOrgAndEnterApp(){
  var {data:membership,error}=await sb
    .from('org_members')
    .select('org_id, organizations(id, name, subscription_status, trial_ends_at)')
    .eq('user_id',currentUser.id)
    .single();

  if(error||!membership){
    showAuthError('No store found for this account. Please contact support.');
    return;
  }

  currentOrgId=membership.org_id;
  currentOrgName=membership.organizations.name;
  currentOrgSubStatus=membership.organizations.subscription_status;
  currentOrgTrialEndsAt=membership.organizations.trial_ends_at;

  applyBranding();

  if(isTrialExpired()){ showTrialGate(); return; }

  document.getElementById('auth-screen').style.display='none';
  document.getElementById('trial-gate-screen').style.display='none';
  document.getElementById('app-shell').style.display='';
}

function isTrialExpired(){
  if(currentOrgSubStatus==='active')return false;
  if(currentOrgSubStatus==='trialing'){
    return new Date(currentOrgTrialEndsAt)<new Date();
  }
  // 'past_due' or 'canceled' — treat as blocked
  return true;
}

function showTrialGate(){
  document.getElementById('auth-screen').style.display='none';
  document.getElementById('app-shell').style.display='none';
  var nameEl=document.getElementById('trial-gate-org-name');
  if(nameEl)nameEl.textContent=currentOrgName||'your store';
  document.getElementById('trial-gate-screen').style.display='';
}

function applyBranding(){
  var nameEl=document.getElementById('app-brand-name');
  var subEl=document.getElementById('app-brand-sub');
  var navEl=document.getElementById('app-nav-label');
  if(nameEl)nameEl.textContent=currentOrgName;
  if(subEl)subEl.textContent='Inventory Management';
  if(navEl)navEl.textContent=currentOrgName;
}

function resetBranding(){
  var nameEl=document.getElementById('app-brand-name');
  var subEl=document.getElementById('app-brand-sub');
  var navEl=document.getElementById('app-nav-label');
  if(nameEl)nameEl.textContent='SATKEN';
  if(subEl)subEl.textContent='Inventory Management';
  if(navEl)navEl.textContent='SATKEN';
}

document.addEventListener('DOMContentLoaded',async function(){
  var {data:{session}}=await sb.auth.getSession();
  if(session){
    currentUser=session.user;
    await resolveOrgAndEnterApp();
  } else {
    document.getElementById('auth-screen').style.display='';
  }
});
