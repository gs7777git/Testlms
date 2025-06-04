
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService, AdminRegistrationData } from '../../services/api';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { APP_NAME } from '../../constants';

export const RegisterAdminPage: React.FC = () => {
  const [formData, setFormData] = useState<AdminRegistrationData>({
    fullName: '',
    email: '',
    passwordInput: '', // Matched with UserModal for consistency
    confirmPassword: '',
    organizationName: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationMessage, setRegistrationMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError(null); // Clear general error on new input
  };

  const validate = (): boolean => {
    if (!formData.fullName.trim()) { setError('Full name is required.'); return false; }
    if (!formData.email.trim()) { setError('Email is required.'); return false; }
    if (!/\S+@\S+\.\S+/.test(formData.email)) { setError('Email is invalid.'); return false; }
    if (!formData.organizationName.trim()) { setError('Organization name is required.'); return false; }
    if (!formData.passwordInput) { setError('Password is required.'); return false; }
    if (formData.passwordInput.length < 6) { setError('Password must be at least 6 characters.'); return false; }
    if (formData.passwordInput !== formData.confirmPassword) { setError('Passwords do not match.'); return false; }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setRegistrationMessage(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      // Use passwordInput from formData, which corresponds to 'password' expected by Supabase signUp
      const registrationPayload: AdminRegistrationData = {
          email: formData.email,
          passwordInput: formData.passwordInput, // This is the actual password
          fullName: formData.fullName,
          organizationName: formData.organizationName,
          // confirmPassword is not sent, it's for client-side validation only
      };
      await authService.registerAdminAndOrganization(registrationPayload);
      setRegistrationMessage(`Registration successful! Please check your email at ${formData.email} to verify your account. Once verified, you can log in.`);
      setFormData({ fullName: '', email: '', passwordInput: '', confirmPassword: '', organizationName: '' }); // Clear form
      // setTimeout(() => navigate('/login'), 5000); // Optional: redirect after a delay
    } catch (err: any) {
      console.error("Registration error:", err);
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-secondary-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <img
          className="mx-auto h-12 w-auto"
          src="https://tailwindui.com/img/logos/mark.svg?color=indigo&shade=600"
          alt={APP_NAME}
        />
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-secondary-900">
          Register Your Organization
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {registrationMessage ? (
            <div className="rounded-md bg-green-50 p-4 text-center">
              <div className="flex justify-center">
                <div className="flex-shrink-0">
                  <svg className="h-10 w-10 text-green-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                </div>
              </div>
              <p className="mt-3 text-sm font-medium text-green-800">{registrationMessage}</p>
              <div className="mt-4">
                <Button onClick={() => navigate('/login')} variant="primary">
                  Go to Login
                </Button>
              </div>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <Input
                label="Full Name"
                id="fullName"
                name="fullName"
                type="text"
                autoComplete="name"
                required
                value={formData.fullName}
                onChange={handleChange}
                disabled={isSubmitting}
              />
              <Input
                label="Email Address"
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleChange}
                disabled={isSubmitting}
              />
              <Input
                label="Organization Name"
                id="organizationName"
                name="organizationName"
                type="text"
                required
                value={formData.organizationName}
                onChange={handleChange}
                disabled={isSubmitting}
              />
              <Input
                label="Password"
                id="passwordInput"
                name="passwordInput"
                type="password"
                autoComplete="new-password"
                required
                value={formData.passwordInput}
                onChange={handleChange}
                disabled={isSubmitting}
              />
              <Input
                label="Confirm Password"
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={isSubmitting}
              />
              {error && (
                <div className="rounded-md bg-red-50 p-4" role="alert">
                  <div className="flex">
                    <div className="flex-shrink-0">
                       <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-red-800">{error}</p>
                    </div>
                  </div>
                </div>
              )}
              <div>
                <Button type="submit" className="w-full" isLoading={isSubmitting} disabled={isSubmitting}>
                  Register
                </Button>
              </div>
              <div className="text-sm text-center">
                <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">
                  Already have an account? Login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
