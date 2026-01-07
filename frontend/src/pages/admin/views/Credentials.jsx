import CredentialsTab from '../CredentialsTab';

export default function Credentials() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">凭证池</h2>
        <p className="text-dark-400">管理 API 密钥和凭证</p>
      </div>
      <CredentialsTab />
    </div>
  );
}